/**
 * NFC Worker — Child process that handles low-level NFC hardware communication.
 *
 * Architecture:
 *   server.ts → nfcService.ts (parent) ←IPC messages→ nfcWorker.ts (child) ←APDU→ USB NFC Reader
 *
 * This worker is forked by nfcService.ts and communicates via process.send/on('message').
 * It uses the nfc-pcsc library which wraps the PC/SC (Personal Computer/Smart Card) subsystem.
 *
 * Supported tag types:
 *   - NTAG213 (144 bytes user memory, pages 4–39)
 *   - NTAG215 (504 bytes user memory, pages 4–129)
 *   - NTAG216 (888 bytes user memory, pages 4–225)
 *   - MIFARE Classic 1K (as fallback)
 *
 * NTAG Memory Layout:
 *   Page 0:    Serial number (UID bytes 0–2) + internal byte
 *   Page 1:    Serial number (UID bytes 3–6)
 *   Page 2:    Serial number check byte + internal byte + lock bytes (2 bytes)
 *   Page 3:    Capability Container (CC) — must be set for NDEF
 *   Page 4+:   User data area (NDEF TLV messages start here)
 *   Last 5pp:  Configuration pages (AUTH0, ACCESS, PWD, PACK)
 *
 * Each NTAG page is exactly 4 bytes. The WRITE command writes one page at a time.
 * The READ command returns 4 pages (16 bytes) at a time.
 */

// ============================================================================
// Transmit function type
// ============================================================================

type TransmitFn = (apdu: Buffer, responseLength: number) => Promise<Buffer>;

// ============================================================================
// NDEF Writer — Encodes URLs into NDEF format for NFC tags
// ============================================================================

class NDEFWriter {
  /**
   * Create an NDEF URI Record.
   *
   * NDEF Record structure (Short Record format):
   *   Byte 0:  Header flags
   *            Bit 7: MB (Message Begin) = 1
   *            Bit 6: ME (Message End) = 1
   *            Bit 5: CF (Chunk Flag) = 0
   *            Bit 4: SR (Short Record) = 1  ← payload length fits in 1 byte
   *            Bit 3: IL (ID Length present) = 0
   *            Bits 2-0: TNF = 001 (Well-Known)
   *            → Combined: 0xD1
   *   Byte 1:  Type Length = 1 (the type field 'U' is 1 byte)
   *   Byte 2:  Payload Length (1 byte because SR=1)
   *   Byte 3:  Type = 0x55 ('U' for URI)
   *   Byte 4:  URI Identifier Code (protocol prefix — saves space on tag)
   *   Byte 5+: URI data (the part after the protocol prefix)
   *
   * URI Identifier Codes (NFC Forum RTD URI specification):
   *   0x00 = No prepending (full URI in data)
   *   0x01 = http://www.
   *   0x02 = https://www.
   *   0x03 = http://
   *   0x04 = https://
   *   0x05 = tel:
   *   0x06 = mailto:
   */
  static createURIRecord(url: string): Buffer {
    let protocolCode = 0x00;
    let uriPart = url;

    // Match the longest prefix first to avoid partial matches
    if (url.startsWith('https://www.')) {
      protocolCode = 0x02;
      uriPart = url.substring(12);
    } else if (url.startsWith('http://www.')) {
      protocolCode = 0x01;
      uriPart = url.substring(11);
    } else if (url.startsWith('https://')) {
      protocolCode = 0x04;
      uriPart = url.substring(8);
    } else if (url.startsWith('http://')) {
      protocolCode = 0x03;
      uriPart = url.substring(7);
    }

    // Payload = [protocol_code] + [uri_bytes]
    const uriBytes = Buffer.from(uriPart, 'utf-8');
    const payload = Buffer.concat([Buffer.from([protocolCode]), uriBytes]);

    // NDEF Record Header
    const header = 0xD1; // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1 (Well-Known)
    const typeLength = 1;
    const payloadLength = payload.length;
    const type = Buffer.from('U'); // URI record type

    return Buffer.concat([
      Buffer.from([header, typeLength, payloadLength]),
      type,
      payload,
    ]);
  }

  /**
   * Wrap an NDEF record in TLV (Tag-Length-Value) format for writing to tag.
   *
   * NDEF data on an NTAG is stored as TLV blocks:
   *   [0x03] [length] [NDEF record bytes...] [0xFE]
   *
   *   0x03 = NDEF Message TLV type
   *   length = number of bytes in the NDEF record
   *            If length < 255, it's 1 byte.
   *            If length >= 255, use 3-byte format: [0xFF] [high byte] [low byte]
   *   0xFE = Terminator TLV (marks end of NDEF data area)
   */
  static wrapInTLV(ndefRecord: Buffer): Buffer {
    if (ndefRecord.length < 255) {
      return Buffer.concat([
        Buffer.from([0x03, ndefRecord.length]),
        ndefRecord,
        Buffer.from([0xFE]),
      ]);
    } else {
      return Buffer.concat([
        Buffer.from([0x03, 0xFF, (ndefRecord.length >> 8) & 0xFF, ndefRecord.length & 0xFF]),
        ndefRecord,
        Buffer.from([0xFE]),
      ]);
    }
  }

  /**
   * Write the Capability Container (CC) to page 3 if not already set.
   *
   * The CC tells NFC-enabled phones that this tag contains NDEF data.
   *   Byte 0: 0xE1 — NDEF magic number (required)
   *   Byte 1: 0x10 — NDEF mapping version 1.0
   *   Byte 2: Size byte — (usable memory / 8). NTAG213=0x12, NTAG215=0x3E, NTAG216=0x6D
   *   Byte 3: 0x00 — read/write access (0x00 = full access, 0x0F = read-only)
   */
  static async ensureCCBlock(transmit: TransmitFn): Promise<boolean> {
    try {
      // Read page 3 (CC block) — READ command returns 16 bytes (4 pages)
      const readCmd = Buffer.from([0xFF, 0xB0, 0x00, 0x03, 0x04]);
      const readRes = await transmit(readCmd, 16);

      if (readRes && readRes.length >= 6) {
        const sw = readRes.slice(-2);
        if (sw[0] === 0x90 && sw[1] === 0x00) {
          const ccData = readRes.slice(0, 4);
          if (ccData[0] === 0xE1) {
            console.log(`[Worker] CC block already set: ${ccData.toString('hex')}`);
            return true;
          }
        }
      }

      // Write CC block — use NTAG215 default size (0x3E = 504 bytes / 8)
      // For NTAG213 this should be 0x12, for NTAG216 it should be 0x6D
      // Using 0x3E as a safe middle ground; phones will still read the tag fine
      console.log('[Worker] Writing CC block to page 3...');
      const ccPage = Buffer.from([0xE1, 0x10, 0x3E, 0x00]);
      const writeCmd = Buffer.concat([
        Buffer.from([0xFF, 0xD6, 0x00, 0x03, 0x04]),
        ccPage,
      ]);

      const writeRes = await transmit(writeCmd, 16);
      const sw = writeRes?.slice(-2);

      if (sw && sw[0] === 0x90 && sw[1] === 0x00) {
        console.log('[Worker] CC block written successfully');
        return true;
      }

      console.log(`[Worker] CC block write failed: ${sw?.toString('hex')}`);
      return false;
    } catch (e: any) {
      console.log(`[Worker] CC block error: ${e.message}`);
      return false;
    }
  }

  /**
   * Write NDEF data to an NTAG tag, page by page.
   *
   * NTAG WRITE command (SCardTransmit APDU via PC/SC):
   *   CLA=0xFF  INS=0xD6  P1=0x00  P2=<page>  Lc=0x04  [4 bytes data]
   *
   *   - Each page is exactly 4 bytes on NTAG chips
   *   - User data starts at page 4
   *   - Pages 0–3 are system/CC pages (do not write to pages 0–2)
   *   - The last 5 pages are configuration (AUTH0, ACCESS, PWD, PACK, etc.)
   *
   * NTAG READ command:
   *   CLA=0xFF  INS=0xB0  P1=0x00  P2=<page>  Le=0x10
   *   Returns 16 bytes (4 consecutive pages) + 2-byte status word
   *
   * Status words:
   *   90 00 = Success
   *   63 00 = Operation failed
   *   6A 82 = Function not supported / page out of range
   */
  static async writeNDEFToTag(transmit: TransmitFn, ndefRecord: Buffer): Promise<boolean> {
    try {
      // Step 1: Ensure CC block is set (page 3)
      const ccOk = await this.ensureCCBlock(transmit);
      if (!ccOk) {
        console.log('[Worker] Could not write CC block — attempting data write anyway');
      }

      // Step 2: Wrap NDEF record in TLV format
      const tlvData = this.wrapInTLV(ndefRecord);
      console.log(`[Worker] NDEF TLV data: ${tlvData.length} bytes → ${tlvData.toString('hex')}`);

      // Step 3: Write TLV data page by page (4 bytes each), starting at page 4
      const startPage = 4;
      const pageSize = 4;
      const totalPages = Math.ceil(tlvData.length / pageSize);
      let pagesWritten = 0;

      // Send progress to parent
      if (process.send) {
        process.send({ type: 'write:progress', data: { stage: 'writing', totalPages } });
      }

      for (let i = 0; i < totalPages; i++) {
        const page = startPage + i;
        const offset = i * pageSize;

        // Extract 4 bytes for this page, zero-pad if needed
        let pageData = tlvData.slice(offset, offset + pageSize);
        if (pageData.length < pageSize) {
          pageData = Buffer.concat([pageData, Buffer.alloc(pageSize - pageData.length, 0x00)]);
        }

        // NTAG WRITE command: FF D6 00 <page> 04 <4 bytes>
        const writeCmd = Buffer.concat([
          Buffer.from([0xFF, 0xD6, 0x00, page, 0x04]),
          pageData,
        ]);

        console.log(`[Worker] Writing page ${page}: ${pageData.toString('hex')}`);

        try {
          const response = await transmit(writeCmd, 16);
          const sw = response?.slice(-2);

          if (sw && sw[0] === 0x90 && sw[1] === 0x00) {
            pagesWritten++;
          } else {
            console.log(`[Worker] Page ${page} write failed: SW=${sw?.toString('hex')}`);
          }
        } catch (e: any) {
          console.log(`[Worker] Page ${page} exception: ${e.message}`);
        }
      }

      // Step 4: Verify by reading back
      if (pagesWritten > 0) {
        if (process.send) {
          process.send({ type: 'write:progress', data: { stage: 'verifying' } });
        }

        console.log(`[Worker] Wrote ${pagesWritten}/${totalPages} pages. Verifying...`);

        try {
          const verifyCmd = Buffer.from([0xFF, 0xB0, 0x00, 0x04, 0x10]);
          const verifyRes = await transmit(verifyCmd, 32);

          if (verifyRes && verifyRes.length > 2) {
            const readData = verifyRes.slice(0, verifyRes.length - 2);
            const expected = tlvData.slice(0, Math.min(16, tlvData.length));
            const actual = readData.slice(0, expected.length);

            if (actual.equals(expected)) {
              console.log('[Worker] Verification PASSED — data matches');
            } else {
              console.log(`[Worker] Verification MISMATCH — expected: ${expected.toString('hex')}, got: ${actual.toString('hex')}`);
            }
          }
        } catch (e: any) {
          console.log(`[Worker] Verification read error: ${e.message}`);
        }

        return pagesWritten === totalPages;
      }

      console.log('[Worker] Failed to write any pages');
      return false;
    } catch (e: any) {
      console.log(`[Worker] writeNDEFToTag error: ${e.message}`);
      return false;
    }
  }

  /**
   * Attempt authentication before writing.
   *
   * NTAG tags may have PWD_AUTH enabled. We try common default passwords.
   * If the tag isn't password-protected, this is a no-op (won't fail the flow).
   *
   * MIFARE Classic tags use a different authentication scheme with 6-byte keys.
   * We try that as a fallback in case the tag is MIFARE Classic instead of NTAG.
   */
  static async tryAuthenticate(transmit: TransmitFn): Promise<boolean> {
    const passwords = [
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
    ];

    for (const pwd of passwords) {
      try {
        // NTAG PWD_AUTH via pseudo-APDU (InDataExchange wrapping)
        const authCmd = Buffer.concat([
          Buffer.from([0xFF, 0x00, 0x00, 0x00, 0x07, 0xD4, 0x42, 0x1B]),
          pwd,
        ]);

        const res = await transmit(authCmd, 32);
        const sw = res?.slice(-2);

        if (sw && sw[0] === 0x90 && sw[1] === 0x00) {
          console.log(`[Worker] PWD_AUTH success with ${pwd.toString('hex')}`);
          return true;
        }
      } catch {
        // Not supported or failed — continue
      }
    }

    // Fallback: MIFARE Classic Key A authentication
    try {
      // Load default key (FF FF FF FF FF FF) into reader key slot 0
      const loadKeyCmd = Buffer.concat([
        Buffer.from([0xFF, 0x82, 0x00, 0x00, 0x06]),
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
      ]);
      const loadRes = await transmit(loadKeyCmd, 16);

      if (loadRes?.slice(-2)?.[0] === 0x90) {
        // Authenticate block 4 with Key A from slot 0
        const authCmd = Buffer.from([0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 0x04, 0x60, 0x00]);
        const authRes = await transmit(authCmd, 16);

        if (authRes?.slice(-2)?.[0] === 0x90) {
          console.log('[Worker] MIFARE Classic auth success');
          return true;
        }
      }
    } catch {
      // Not a MIFARE Classic tag
    }

    console.log('[Worker] Auth not needed or failed — proceeding without');
    return false;
  }
}

// ============================================================================
// NDEF Parser — Decodes NDEF messages read from NFC tags
// ============================================================================

class NDEFParser {
  static readonly URI_PROTOCOLS: { [key: number]: string } = {
    0x00: '',
    0x01: 'http://www.',
    0x02: 'https://www.',
    0x03: 'http://',
    0x04: 'https://',
    0x05: 'tel:',
    0x06: 'mailto:',
  };

  /**
   * Parse NDEF data from raw bytes read from the tag's user data area.
   * Handles TLV-wrapped data (starts with 0x03) and bare NDEF records.
   */
  static parseNDEF(buffer: Buffer): { url: string | null } {
    try {
      if (buffer.length < 3) return { url: null };

      let pos = 0;

      // Skip TLV header if present
      if (buffer[0] === 0x03) {
        pos = 1;
        const len = buffer[pos++];
        if (len === 0xFF) pos += 2; // 3-byte length format
      }

      // Parse NDEF record header
      const header = buffer[pos++];
      const srBit = (header >> 4) & 0x01;
      const tnf = header & 0x07;

      if (pos >= buffer.length) return { url: null };
      const typeLength = buffer[pos++];

      let payloadLength: number;
      if (srBit) {
        if (pos >= buffer.length) return { url: null };
        payloadLength = buffer[pos++];
      } else {
        if (pos + 3 >= buffer.length) return { url: null };
        payloadLength = buffer.readUInt32BE(pos);
        pos += 4;
      }

      // Read type
      if (pos + typeLength > buffer.length) return { url: null };
      const recordType = buffer.slice(pos, pos + typeLength);
      pos += typeLength;

      // Read payload
      if (pos + payloadLength > buffer.length) return { url: null };
      const payload = buffer.slice(pos, pos + payloadLength);

      // URI record: TNF=1 (Well-Known), Type=0x55 ('U')
      if (tnf === 1 && recordType[0] === 0x55 && payloadLength > 0) {
        const protocolCode = payload[0];
        const prefix = this.URI_PROTOCOLS[protocolCode] || '';
        const uriPart = payload.slice(1).toString('utf-8');
        return { url: prefix + uriPart };
      }

      return { url: null };
    } catch {
      return { url: null };
    }
  }
}

// ============================================================================
// Main worker — initialize nfc-pcsc and handle reader/card events
// ============================================================================

try {
  console.log('[Worker] Loading nfc-pcsc...');
  const { NFC } = require('nfc-pcsc');

  const nfc = new NFC();
  if (process.send) process.send({ type: 'ready' });

  let readerCount = 0;

  nfc.on('reader', (reader: any) => {
    readerCount++;
    console.log(`[Worker] Reader ${readerCount} connected: ${reader.name}`);
    if (process.send) process.send({ type: 'reader:connect', data: { name: reader.name, connected: true } });

    // Wrap transmit for APDU logging
    const originalTransmit = reader.transmit.bind(reader);
    const transmit: TransmitFn = async (apdu: Buffer, responseLength: number): Promise<Buffer> => {
      console.log(`[Worker] >>> APDU: ${apdu.toString('hex')}`);
      const response = await originalTransmit(apdu, responseLength);
      const sw = response?.length >= 2 ? response.slice(-2).toString('hex') : 'none';
      console.log(`[Worker] <<< Response: ${response?.toString('hex') || 'empty'} [SW: ${sw}]`);
      return response;
    };

    // ---- Card tapped on reader ----
    reader.on('card', (card: any) => {
      console.log(`[Worker] Card detected — UID: ${card.uid}, ATR: ${card.atr.toString('hex')}`);

      const cardData: any = {
        reader: reader.name,
        uid: card.uid,
        atr: card.atr.toString('hex'),
        url: null as string | null,
      };

      const writeRequest = (process as any).nfcWriteRequest;

      if (writeRequest?.active) {
        // ============================
        // WRITE MODE
        // ============================
        console.log(`[Worker] Write mode active — target URL: ${writeRequest.url}`);

        const doWrite = async () => {
          try {
            if (process.send) {
              process.send({ type: 'write:progress', data: { stage: 'card-detected', uid: card.uid } });
            }

            // Authenticate (best-effort, won't fail flow)
            await NDEFWriter.tryAuthenticate(transmit);

            // Check existing data to avoid overwriting pet records
            let existingUrl: string | null = null;
            try {
              const readCmd = Buffer.from([0xFF, 0xB0, 0x00, 0x04, 0x10]);
              const readRes = await transmit(readCmd, 32);
              if (readRes && readRes.length > 2) {
                const parsed = NDEFParser.parseNDEF(readRes.slice(0, readRes.length - 2));
                existingUrl = parsed.url;
              }
            } catch {
              // Tag may be empty or unformatted
            }

            if (existingUrl && existingUrl.includes('/pet/')) {
              console.log(`[Worker] Tag has existing pet record: ${existingUrl} — preserving`);
              cardData.url = existingUrl;
              cardData.writeSuccess = true;
              cardData.message = 'Tag already contains a pet record — preserved';
            } else {
              // Write the NDEF URI record
              const ndefRecord = NDEFWriter.createURIRecord(writeRequest.url);
              const success = await NDEFWriter.writeNDEFToTag(transmit, ndefRecord);

              cardData.url = writeRequest.url;
              cardData.writeSuccess = success;
              cardData.message = success
                ? 'Successfully wrote pet profile URL to NFC tag'
                : 'Write failed — tag may be write-protected';
            }
          } catch (e: any) {
            console.log(`[Worker] Write error: ${e.message}`);
            cardData.writeSuccess = false;
            cardData.message = `Write error: ${e.message}`;
          }

          if (process.send) process.send({ type: 'card:write-complete', data: cardData });
          (process as any).nfcWriteRequest = null;
        };

        doWrite().catch((err) => {
          cardData.writeSuccess = false;
          cardData.message = err.message;
          if (process.send) process.send({ type: 'card:write-complete', data: cardData });
          (process as any).nfcWriteRequest = null;
        });

      } else {
        // ============================
        // READ MODE
        // ============================
        const doRead = async () => {
          try {
            let allData = Buffer.alloc(0);

            // Read pages 4–20 (enough for typical URLs)
            for (let page = 4; page <= 20; page += 4) {
              try {
                const readCmd = Buffer.from([0xFF, 0xB0, 0x00, page, 0x10]);
                const response = await transmit(readCmd, 32);
                if (response && response.length > 2) {
                  allData = Buffer.concat([allData, response.slice(0, response.length - 2)]);
                }
              } catch {
                break;
              }
            }

            if (allData.length > 0) {
              const parsed = NDEFParser.parseNDEF(allData);
              if (parsed.url) {
                cardData.url = parsed.url;
                console.log(`[Worker] Read URL: ${cardData.url}`);
              }
            }
          } catch (e: any) {
            console.log(`[Worker] Read error: ${e.message}`);
          }

          if (process.send) process.send({ type: 'card', data: cardData });
        };

        doRead().catch(() => {
          if (process.send) process.send({ type: 'card', data: cardData });
        });
      }
    });

    reader.on('card.off', (card: any) => {
      console.log(`[Worker] Card removed: ${card.uid}`);
      if (process.send) process.send({ type: 'card:remove', data: { reader: reader.name, uid: card.uid } });
    });

    reader.on('error', (err: Error) => {
      console.error(`[Worker] Reader error on ${reader.name}: ${err.message}`);
      if (process.send) process.send({ type: 'error', data: err.message });
    });

    reader.on('end', () => {
      console.log(`[Worker] Reader disconnected: ${reader.name}`);
      if (process.send) process.send({ type: 'reader:disconnect', data: { name: reader.name, connected: false } });
    });
  });

  nfc.on('error', (err: Error) => {
    console.error('[Worker] NFC error:', err.message);
    if (process.send) process.send({ type: 'error', data: err.message });
  });

  setTimeout(() => {
    if (readerCount === 0) {
      console.log('[Worker] No readers detected yet. Waiting for USB NFC reader...');
    }
  }, 3000);

  // Listen for write requests from parent (nfcService)
  if (process.on) {
    process.on('message', (msg: any) => {
      if (msg.type === 'write-request') {
        const { url } = msg.data;
        console.log(`[Worker] Write request received — URL: ${url}`);

        (process as any).nfcWriteRequest = {
          active: true,
          url,
          timestamp: Date.now(),
        };

        console.log('[Worker] Write mode ON — place NFC tag on reader...');
      }
    });
  }

} catch (err: any) {
  console.error('[Worker] Failed to initialize NFC:', err.message);
  if (process.send) process.send({ type: 'init-failed', data: err.message });
  process.exit(1);
}
