// NDEF Writer
class NDEFWriter {
  /**
   * Create NDEF URI Record
   * TNF=1 (Well-Known), Type='U' (0x55)
   */
  static createURIRecord(url: string): Buffer {
    // Determine protocol code
    let protocolCode = 0x00;
    let uriPart = url;

    if (url.startsWith('https://www.')) {
      protocolCode = 0x02;
      uriPart = url.substring(12); // Remove 'https://www.'
    } else if (url.startsWith('http://www.')) {
      protocolCode = 0x01;
      uriPart = url.substring(11); // Remove 'http://www.'
    } else if (url.startsWith('https://')) {
      protocolCode = 0x04;
      uriPart = url.substring(8); // Remove 'https://'
    } else if (url.startsWith('http://')) {
      protocolCode = 0x03;
      uriPart = url.substring(7); // Remove 'http://'
    }

    // Create payload: [protocol_code] + [uri_data]
    const uriBytes = Buffer.from(uriPart, 'utf-8');
    const payload = Buffer.concat([Buffer.from([protocolCode]), uriBytes]);

    // Create NDEF record header
    const header = 0xD1; // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1 (Well-Known)
    const typeLength = 1;
    const payloadLength = payload.length;
    const type = Buffer.from('U'); // URI record type

    // Combine: header + typeLength + payloadLength + type + payload
    return Buffer.concat([
      Buffer.from([header]),
      Buffer.from([typeLength]),
      Buffer.from([payloadLength]),
      type,
      payload,
    ]);
  }

  /**
   * Diagnostic: Read and analyze NTAG 215 card configuration
   * Helps identify protection/lock status and card state
   */
  static async diagnosticCardAnalysis(reader: any): Promise<any> {
    try {
      console.log(`[Worker] === NTAG 215 DIAGNOSTIC ANALYSIS ===`);
      const diagnostics: any = {};

      // Read block 3 (Capability Container)
      console.log(`[Worker] Reading CC block (block 3)...`);
      try {
        const ccCmd = Buffer.from([0xFF, 0xB0, 0x00, 0x03, 0x10]);
        const ccRes = await reader.transmit(ccCmd, 32);
        if (ccRes && ccRes.length > 2) {
          const ccData = ccRes.slice(0, ccRes.length - 2);
          diagnostics.ccBlock = ccData.toString('hex');
          console.log(`[Worker] CC Block: ${ccData.toString('hex')}`);
          console.log(`[Worker]   - E1 present: ${ccData[0] === 0xE1 ? 'YES ✓' : 'NO ✗'}`);
        }
      } catch (e: any) {
        console.log(`[Worker] CC read error: ${e.message}`);
      }

      // Read dynamic lock bytes (block 2, offset 0-1)
      console.log(`[Worker] Reading dynamic lock bytes (block 2)...`);
      try {
        const lockCmd = Buffer.from([0xFF, 0xB0, 0x00, 0x02, 0x10]);
        const lockRes = await reader.transmit(lockCmd, 32);
        if (lockRes && lockRes.length > 2) {
          const lockData = lockRes.slice(0, lockRes.length - 2);
          diagnostics.lockBytes = lockData.toString('hex');
          // Lock bytes are at offset 2-3 in block 2
          const lockBits = lockData.slice(2, 4);
          console.log(`[Worker] Lock bytes: ${lockBits.toString('hex')}`);
          console.log(`[Worker]   - Indicates write protection status`);
        }
      } catch (e: any) {
        console.log(`[Worker] Lock bytes read error: ${e.message}`);
      }

      // Read AUTH0 configuration (block 135, part of last user block)
      // Note: This may not be directly readable on NTAG215
      console.log(`[Worker] Reading AUTH0 block (block 135)...`);
      try {
        // Block 135 is special - might not be readable with standard read
        const auth0Cmd = Buffer.from([0xFF, 0xB0, 0x00, 0x86, 0x10]);
        const auth0Res = await reader.transmit(auth0Cmd, 32);
        if (auth0Res && auth0Res.length > 2) {
          const auth0Data = auth0Res.slice(0, auth0Res.length - 2);
          diagnostics.auth0 = auth0Data.toString('hex');
          console.log(`[Worker] AUTH0 Block: ${auth0Data.toString('hex')}`);
        }
      } catch (e: any) {
        console.log(`[Worker] AUTH0 read may not be available: ${e.message}`);
      }

      // Try unauthenticated write to block 4 to test write access
      console.log(`[Worker] Testing write access (attempting to write test data to block 4)...`);
      try {
        const testData = Buffer.concat([
          Buffer.from('TEST'),
          Buffer.alloc(12, 0)
        ]);
        const testCmd = Buffer.concat([
          Buffer.from([0xFF, 0xD0, 0x00, 0x04, 0x10]),
          testData
        ]);
        const testRes = await reader.transmit(testCmd, 32);
        const testStatus = testRes?.slice(-2);
        if (testStatus?.[0] === 0x90 && testStatus?.[1] === 0x00) {
          diagnostics.blockWritable = true;
          console.log(`[Worker] ✓ Block 4 is WRITABLE (not protected)`);
        } else {
          diagnostics.blockWritable = false;
          diagnostics.writeError = testStatus?.toString('hex');
          console.log(`[Worker] ✗ Block 4 write failed: ${testStatus?.toString('hex')}`);
          console.log(`[Worker]    This indicates write protection is ACTIVE`);
        }
      } catch (e: any) {
        console.log(`[Worker] Write test error: ${e.message}`);
        diagnostics.blockWritable = false;
      }

      console.log(`[Worker] === END DIAGNOSTIC ===`);
      diagnostics.timestamp = new Date().toISOString();
      return diagnostics;
    } catch (e: any) {
      console.log(`[Worker] Diagnostic error: ${e.message}`);
      return { error: e.message };
    }
  }

  /**
   * Authenticate with NTAG card using PWD_AUTH command
   * Tries default passwords: 0xFFFFFFFF, 0x00000000, 0xAABBCCDD
   */
  static async authenticateCard(reader: any, password?: Buffer): Promise<boolean> {
    try {
      const pwd = password || Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      const pwdHex = pwd.toString('hex').toUpperCase();
      console.log(`[Worker] Attempting NTAG authentication with password ${pwdHex}...`);

      // PWD_AUTH command format: FF 00 00 E2 04 [4-byte password] 04
      const authCommand = Buffer.concat([
        Buffer.from([0xFF, 0x00, 0x00, 0xE2, 0x04]),
        pwd,
        Buffer.from([0x04])
      ]);

      const response = await reader.transmit(authCommand, 32);

      if (!response || response.length < 2) {
        console.log(`[Worker] No response from authentication`);
        return false;
      }

      const status = response.slice(-2);

      if (status[0] === 0x90 && status[1] === 0x00) {
        console.log(`[Worker] ✓ Authentication successful with password ${pwdHex}`);
        return true;
      } else if (status[0] === 0x63) {
        console.log(`[Worker] ✗ Authentication failed: Wrong password (${status.toString('hex')})`);
        return false;
      } else if (status[0] === 0x6A && status[1] === 0x82) {
        console.log(`[Worker] ✓ Card not password-protected (no auth needed)`);
        return true; // Card doesn't require authentication
      } else {
        console.log(`[Worker] ✗ Unexpected authentication response: ${status.toString('hex')}`);
        return false;
      }
    } catch (e: any) {
      console.log(`[Worker] Authentication error: ${e.message}`);
      return false;
    }
  }

  /**
   * Authenticate using MIFARE Classic protocol (alternative to PWD_AUTH)
   * Some NTAG variants may respond to MIFARE authentication
   */
  static async authenticateMIFARE(reader: any, keyA?: Buffer): Promise<boolean> {
    try {
      const key = keyA || Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); // Default MIFARE key
      const keyHex = key.toString('hex').toUpperCase();
      console.log(`[Worker] Attempting MIFARE Classic authentication with key ${keyHex}...`);

      // MIFARE Authenticate command: FF 86 00 00 07 [1-byte block] [1-byte key type] [6-byte key]
      // Key type: 0x60 = Key A, 0x61 = Key B
      const authCommand = Buffer.concat([
        Buffer.from([0xFF, 0x86, 0x00, 0x00, 0x07, 0x04, 0x60]), // Authenticate block 4 with Key A
        key
      ]);

      const response = await reader.transmit(authCommand, 32);

      if (!response || response.length < 2) {
        console.log(`[Worker] No response from MIFARE authentication`);
        return false;
      }

      const status = response.slice(-2);

      if (status[0] === 0x90 && status[1] === 0x00) {
        console.log(`[Worker] ✓ MIFARE authentication successful with key ${keyHex}`);
        return true;
      } else {
        console.log(`[Worker] ✗ MIFARE authentication failed: ${status.toString('hex')}`);
        return false;
      }
    } catch (e: any) {
      console.log(`[Worker] MIFARE authentication error: ${e.message}`);
      return false;
    }
  }

  /**
   * Format card as NDEF (if not already formatted)
   * Writes CC (Capability Container) block to block 3
   */
  static async formatAsNDEF(reader: any): Promise<boolean> {
    try {
      console.log(`[Worker] Checking if card is NDEF formatted...`);

      // Read block 3 to check for CC (Capability Container)
      const ccBlockCommand = Buffer.from([0xFF, 0xB0, 0x00, 0x03, 0x10]);
      const ccResponse = await reader.transmit(ccBlockCommand, 32);

      if (ccResponse && ccResponse.length > 2) {
        const ccData = ccResponse.slice(0, ccResponse.length - 2);
        const ndefMagic = ccData[0]; // Should be 0xE1 for NDEF

        if (ndefMagic === 0xE1) {
          console.log(`[Worker] Card is already NDEF formatted (CC block found)`);
          return true;
        }
      }

      console.log(`[Worker] Card is not NDEF formatted, writing CC block...`);

      // Write CC block: E1 10 06 00
      // E1 = NDEF Magic Number
      // 10 = Version (1.0)
      // 06 = Data area size (96 bytes = 0x60 >> 1, for NTAG213/215/216)
      // 00 = Read-only flag (not set)
      const ccBlock = Buffer.concat([
        Buffer.from([0xE1, 0x10, 0x06, 0x00]),
        Buffer.alloc(12, 0)  // Pad to 16 bytes
      ]);

      const ccWriteCommand = Buffer.concat([
        Buffer.from([0xFF, 0xD0, 0x00, 0x03, 0x10]),
        ccBlock
      ]);

      const ccWriteResponse = await reader.transmit(ccWriteCommand, 32);
      const ccStatus = ccWriteResponse?.slice(-2);

      if (ccStatus?.[0] === 0x90 && ccStatus?.[1] === 0x00) {
        console.log(`[Worker] CC block written successfully`);
        return true;
      } else {
        console.log(`[Worker] Failed to write CC block: ${ccStatus?.toString('hex')}`);
        return false;
      }
    } catch (e: any) {
      console.log(`[Worker] Format as NDEF error: ${e.message}`);
      return false;
    }
  }

  /**
   * Complete factory reset of NTAG card
   * Attempts authentication first, then clears all data and removes protection
   */
  static async factoryResetCard(reader: any): Promise<boolean> {
    try {
      console.log(`[Worker] Performing complete factory reset on card...`);

      const blockSize = 16;

      // Step 0: Attempt authentication with default passwords
      console.log(`[Worker] Attempting authentication with default passwords...`);
      const defaultPasswords = [
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]), // Most common default
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // All zeros
        Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]), // Alternative
        Buffer.from([0x80, 0x80, 0x80, 0x80]), // Another common one
        Buffer.from([0x55, 0x55, 0x55, 0x55]), // Alternating bits
        Buffer.from([0xAA, 0xAA, 0xAA, 0xAA]), // Bitwise inverse
        Buffer.from([0x12, 0x34, 0x56, 0x78]), // Sequential
        Buffer.from([0x00, 0x00, 0x00, 0x01]), // Increment
        Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]), // Common test password
      ];

      let authenticated = false;
      for (const pwd of defaultPasswords) {
        const authSuccess = await this.authenticateCard(reader, pwd);
        if (authSuccess) {
          authenticated = true;
          // Found working password - don't break, continue to ensure auth is set
          break;
        }
      }

      if (authenticated) {
        console.log(`[Worker] ✓ Card authenticated successfully. Proceeding with reset...`);
      } else {
        console.log(`[Worker] ⚠ Could not authenticate with default passwords. Attempting reset without auth...`);
      }

      // Wait a moment after authentication
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 1: Clear the lock bytes first (Address 02 - Block 0)
      // This should disable protection on the card
      console.log(`[Worker] Clearing lock bytes to disable protection...`);
      try {
        const lockCommand = Buffer.concat([
          Buffer.from([0xFF, 0xD0, 0x00, 0x02, blockSize]),
          Buffer.alloc(blockSize, 0x00)  // All zeros to unlock
        ]);

        const lockResponse = await reader.transmit(lockCommand, 32);
        const lockStatus = lockResponse?.slice(-2);

        if (lockStatus?.[0] === 0x90 && lockStatus?.[1] === 0x00) {
          console.log(`[Worker] ✓ Lock bytes cleared`);
        } else {
          console.log(`[Worker] Could not clear lock bytes: ${lockStatus?.toString('hex')}`);
        }
      } catch (e: any) {
        console.log(`[Worker] Lock clear error: ${e.message}`);
      }

      // Step 2: Write zeros to ALL blocks (complete data wipe)
      console.log(`[Worker] Wiping all data blocks...`);
      let blocksCleared = 0;

      for (let block = 0; block <= 20; block++) {
        try {
          const wipeCommand = Buffer.concat([
            Buffer.from([0xFF, 0xD0, 0x00, block, blockSize]),
            Buffer.alloc(blockSize, 0x00)  // All zeros
          ]);

          const response = await reader.transmit(wipeCommand, 32);
          const status = response?.slice(-2);

          if (status?.[0] === 0x90 && status?.[1] === 0x00) {
            console.log(`[Worker] ✓ Cleared block ${block}`);
            blocksCleared++;
          } else {
            console.log(`[Worker] Could not clear block ${block}: ${status?.toString('hex')}`);
          }
        } catch (e: any) {
          console.log(`[Worker] Clear error at block ${block}: ${e.message}`);
        }
      }

      console.log(`[Worker] Factory reset complete - cleared ${blocksCleared} blocks`);

      // Wait a moment for the card to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (e: any) {
      console.log(`[Worker] Factory reset error: ${e.message}`);
      return false;
    }
  }

  /**
   * Write NDEF data to NFC tag
   * Attempts authentication first, then writes data with proper TLV formatting
   */
  static async writeToTag(reader: any, ndefRecord: Buffer): Promise<boolean> {
    try {
      console.log(`[Worker] Starting NDEF write to NTAG card...`);

      const blockSize = 16;
      let startBlock = 4;  // Start from block 4 - blocks 0-3 are system/reserved

      // Step 1: Attempt NTAG PWD_AUTH authentication with default passwords
      console.log(`[Worker] Attempting NTAG authentication before write...`);
      const defaultPasswords = [
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]), // Most common default
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // All zeros
        Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]), // Alternative
        Buffer.from([0x80, 0x80, 0x80, 0x80]), // Another common one
        Buffer.from([0x55, 0x55, 0x55, 0x55]), // Alternating bits
        Buffer.from([0xAA, 0xAA, 0xAA, 0xAA]), // Bitwise inverse
        Buffer.from([0x12, 0x34, 0x56, 0x78]), // Sequential
        Buffer.from([0x00, 0x00, 0x00, 0x01]), // Increment
        Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]), // Common test password
      ];

      let authenticated = false;
      for (const pwd of defaultPasswords) {
        const authSuccess = await this.authenticateCard(reader, pwd);
        if (authSuccess) {
          authenticated = true;
          console.log(`[Worker] ✓ NTAG authentication successful - card is ready for writing`);
          break;
        }
      }

      // If NTAG authentication failed, try MIFARE Classic protocol as fallback
      if (!authenticated) {
        console.log(`[Worker] ⚠ NTAG authentication failed - trying MIFARE Classic protocol...`);
        const mifareKeys = [
          Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]), // Default MIFARE key
          Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // All zeros
          Buffer.from([0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5]), // Common key
          Buffer.from([0x76, 0x77, 0x79, 0x00, 0xF8, 0x69]), // Custom key
        ];

        for (const key of mifareKeys) {
          const mifareSuccess = await this.authenticateMIFARE(reader, key);
          if (mifareSuccess) {
            authenticated = true;
            console.log(`[Worker] ✓ MIFARE authentication successful - card is ready for writing`);
            break;
          }
        }
      }

      if (!authenticated) {
        console.log(`[Worker] ⚠ Could not authenticate with NTAG or MIFARE - attempting direct writes anyway`);
      }

      // Step 2: Write CC (Capability Container) block to block 3 first
      console.log(`[Worker] Writing Capability Container (CC) block to block 3...`);
      const ccBlock = Buffer.concat([
        Buffer.from([0xE1, 0x10, 0x06, 0x00]),  // E1=NDEF, 10=version, 06=size, 00=not read-only
        Buffer.alloc(12, 0)                      // Pad to 16 bytes
      ]);

      const ccWriteCommand = Buffer.concat([
        Buffer.from([0xFF, 0xD0, 0x00, 0x03, 0x10]),
        ccBlock,
      ]);

      try {
        const ccResponse = await reader.transmit(ccWriteCommand, 32);
        const ccStatus = ccResponse?.slice(-2);

        if (ccStatus?.[0] === 0x90 && ccStatus?.[1] === 0x00) {
          console.log(`[Worker] ✓ CC block written successfully`);
        } else {
          console.log(`[Worker] ⚠ Could not write CC block: ${ccStatus?.toString('hex')} - attempting to clear it first`);

          // Try clearing CC block by writing zeros to unlock write protection
          console.log(`[Worker] Attempting to clear CC block to disable write protection...`);
          const clearCCCommand = Buffer.concat([
            Buffer.from([0xFF, 0xD0, 0x00, 0x03, 0x10]),
            Buffer.alloc(16, 0x00)  // Write all zeros to clear CC
          ]);

          try {
            const clearRes = await reader.transmit(clearCCCommand, 32);
            const clearStatus = clearRes?.slice(-2);
            if (clearStatus?.[0] === 0x90 && clearStatus?.[1] === 0x00) {
              console.log(`[Worker] ✓ CC block cleared - write protection may be disabled now`);

              // Wait and try writing CC block again
              await new Promise(resolve => setTimeout(resolve, 100));
              const retryRes = await reader.transmit(ccWriteCommand, 32);
              const retryStatus = retryRes?.slice(-2);
              if (retryStatus?.[0] === 0x90 && retryStatus?.[1] === 0x00) {
                console.log(`[Worker] ✓ CC block written successfully after clearing`);
              }
            } else {
              console.log(`[Worker] Could not clear CC block: ${clearStatus?.toString('hex')}`);
            }
          } catch (e: any) {
            console.log(`[Worker] CC clear error: ${e.message}`);
          }
        }
      } catch (e: any) {
        console.log(`[Worker] ⚠ CC block write exception: ${e.message} - continuing anyway`);
      }

      console.log(`[Worker] Writing NDEF data to card with TLV wrapper...`);

      // Build the NDEF message with TLV wrapper
      // Format: [NDEF Message TLV type: 0x03] [Length] [NDEF Record] [Terminator: 0xFE]
      const ndefWithLength = Buffer.concat([
        Buffer.from([0x03]),                   // NDEF Message TLV type
        Buffer.from([ndefRecord.length]),      // NDEF message length (1 byte)
        ndefRecord,                            // NDEF record(s)
        Buffer.from([0xFE])                    // NDEF Terminator TLV
      ]);

      console.log(`[Worker] NDEF structure: ${ndefWithLength.length} bytes total`);
      console.log(`[Worker]   - NDEF Length: 1 byte (value: ${ndefRecord.length})`);
      console.log(`[Worker]   - NDEF Record: ${ndefRecord.length} bytes`);
      console.log(`[Worker]   - Terminator: 1 byte (0xFE)`);
      console.log(`[Worker]   - Hex data: ${ndefWithLength.toString('hex')}`);

      let blocksWritten = 0;
      const totalBlocks = Math.ceil(ndefWithLength.length / blockSize);

      for (let blockOffset = 0; blockOffset < totalBlocks; blockOffset++) {
        const block = startBlock + blockOffset;
        const dataStart = blockOffset * blockSize;
        const dataEnd = Math.min(dataStart + blockSize, ndefWithLength.length);

        let blockData = ndefWithLength.slice(dataStart, dataEnd);

        // Pad to 16 bytes if necessary
        if (blockData.length < blockSize) {
          blockData = Buffer.concat([blockData, Buffer.alloc(blockSize - blockData.length, 0)]);
        }

        // MIFARE/NTAG Write Block command: FF D0 00 <block> 10 [16 bytes data]
        const writeCommand = Buffer.concat([
          Buffer.from([0xFF, 0xD0, 0x00, block, blockSize]),
          blockData,
        ]);

        console.log(`[Worker] Writing block ${block}: ${blockData.toString('hex')}`);

        try {
          const response = await reader.transmit(writeCommand, 32);

          if (!response || response.length < 2) {
            console.log(`[Worker] No response from write at block ${block}`);
            continue;
          }

          const status = response.slice(-2);
          if (status[0] === 0x90 && status[1] === 0x00) {
            console.log(`[Worker] ✓ Block ${block} written successfully`);
            blocksWritten++;
          } else {
            const statusCode = status.toString('hex');
            console.log(`[Worker] ✗ Write failed at block ${block}: ${statusCode}`);
          }
        } catch (e: any) {
          console.log(`[Worker] Exception writing block ${block}: ${e.message}`);
          continue;
        }
      }

      if (blocksWritten > 0) {
        console.log(`[Worker] ✓ Successfully wrote ${blocksWritten}/${totalBlocks} block(s) to NTAG card`);
        console.log(`[Worker] Data written: ${blocksWritten * blockSize} bytes`);
        console.log(`[Worker] NDEF message is now stored on the card`);
        return true;
      } else {
        console.log(`[Worker] ✗ Failed to write any blocks to card`);
        console.log(`[Worker] The card may be fully protected or in an unusable state`);
        return false;
      }
    } catch (e: any) {
      console.log(`[Worker] Write error: ${e.message}`);
      return false;
    }
  }
}

// NDEF Parser
class NDEFParser {
  static readonly NDEF_TNF = {
    EMPTY: 0,
    WELL_KNOWN: 1,
    MEDIA_TYPE: 2,
    ABSOLUTE_URI: 3,
    EXTERNAL_TYPE: 4,
  };

  static readonly NDEF_RECORD_TYPE = {
    URI: 0x55, // 'U'
    TEXT: 0x54, // 'T'
  };

  static readonly NDEF_URI_PROTOCOL_CODES: { [key: number]: string } = {
    0x00: '',
    0x01: 'http://www.',
    0x02: 'https://www.',
    0x03: 'http://',
    0x04: 'https://',
    0x05: 'tel:',
    0x06: 'mailto:',
    0x07: 'ftp://anonymous:anonymous@',
    0x08: 'ftp://ftp.',
    0x09: 'ftps://',
    0x0a: 'sftp://',
  };

  static parseNDEF(buffer: Buffer): { url: string | null; records: any[] } {
    const records: any[] = [];
    let url: string | null = null;

    try {
      if (buffer.length < 3) {
        console.log('[Worker] Buffer too small for NDEF message');
        return { url: null, records: [] };
      }

      let pos = 0;

      // First check for NDEF message header
      const firstByte = buffer[pos];
      const mbBit = (firstByte >> 7) & 0x01; // Message Begin
      const meBit = (firstByte >> 6) & 0x01; // Message End
      const cfBit = (firstByte >> 5) & 0x01; // Chunk Flag
      const srBit = (firstByte >> 4) & 0x01; // Short Record
      const ilBit = (firstByte >> 3) & 0x01; // ID Length
      const tnf = firstByte & 0x07; // Type Name Format

      console.log(`[Worker] NDEF Header: MB=${mbBit}, ME=${meBit}, CF=${cfBit}, SR=${srBit}, IL=${ilBit}, TNF=${tnf}`);

      pos++; // Move past header

      if (pos >= buffer.length) {
        console.log('[Worker] Invalid NDEF message - no type length field');
        return { url: null, records: [] };
      }

      const typeLength = buffer[pos++];
      console.log(`[Worker] Type Length: ${typeLength}`);

      let payloadLength: number;
      if (srBit) {
        if (pos >= buffer.length) return { url: null, records: [] };
        payloadLength = buffer[pos++];
        console.log(`[Worker] Payload Length (short): ${payloadLength}`);
      } else {
        if (pos + 3 >= buffer.length) return { url: null, records: [] };
        payloadLength = buffer.readUInt32BE(pos);
        pos += 4;
        console.log(`[Worker] Payload Length (standard): ${payloadLength}`);
      }

      // Skip ID Length field if present
      let idLength = 0;
      if (ilBit) {
        if (pos >= buffer.length) return { url: null, records: [] };
        idLength = buffer[pos++];
      }

      // Read type
      if (pos + typeLength > buffer.length) {
        console.log('[Worker] Invalid type length');
        return { url: null, records: [] };
      }
      const recordType = buffer.slice(pos, pos + typeLength);
      pos += typeLength;
      console.log(`[Worker] Record Type: ${recordType.toString('ascii')}`);

      // Skip ID if present
      if (ilBit) {
        pos += idLength;
      }

      // Read payload
      if (pos + payloadLength > buffer.length) {
        console.log(`[Worker] Invalid payload length: ${pos} + ${payloadLength} > ${buffer.length}`);
        return { url: null, records: [] };
      }
      const payload = buffer.slice(pos, pos + payloadLength);

      // Parse based on TNF and type
      if (tnf === this.NDEF_TNF.WELL_KNOWN && recordType[0] === this.NDEF_RECORD_TYPE.URI) {
        // Standard URI record
        console.log('[Worker] Found WELL_KNOWN URI record');
        if (payloadLength > 0) {
          const protocolCode = payload[0];
          const protocolPrefix = this.NDEF_URI_PROTOCOL_CODES[protocolCode] || '';
          const uriPart = payload.slice(1).toString('utf-8');
          url = protocolPrefix + uriPart;
          console.log(`[Worker] Extracted URL: ${url}`);
        }
      } else if (tnf === this.NDEF_TNF.ABSOLUTE_URI) {
        // Absolute URI - type field contains the mime type, payload contains the data
        console.log('[Worker] Found ABSOLUTE_URI record');
        url = payload.toString('utf-8').trim();
        console.log(`[Worker] Extracted URL: ${url}`);
      }

      records.push({ type: recordType, payload, tnf });
    } catch (e: any) {
      console.log(`[Worker] NDEF parsing error: ${e.message}`);
    }

    return { url, records };
  }

  // Fallback: Extract URL from raw ASCII data
  static extractURLFromRawData(buffer: Buffer): string | null {
    try {
      // First, try UTF-8 conversion
      let asciiStr = buffer.toString('utf-8', 0, buffer.length);
      
      console.log(`[Worker] Raw buffer as UTF-8: ${asciiStr.substring(0, 200)}`);
      
      // Also try to extract by looking at the hex directly and converting intelligently
      const hexStr = buffer.toString('hex');
      
      // Look for common URL patterns in hex
      // "https://" = 68747470733a2f2f
      // "http://" = 687474703a2f2f
      // "open.spotify.com" = 6f70656e2e73706f746966792e636f6d
      
      const patterns = [
        { name: 'https', hex: '68747470733a2f2f', prefix: 'https://' },
        { name: 'http', hex: '687474703a2f2f', prefix: 'http://' },
        { name: 'open.spotify', hex: '6f70656e2e73706f746966792e', prefix: 'https://open.spotify.' },
      ];

      for (const pattern of patterns) {
        const index = hexStr.indexOf(pattern.hex);
        if (index !== -1) {
          console.log(`[Worker] Found "${pattern.name}" at hex position ${index}`);
          
          // Extract from this point forward, looking for null byte (00) or control characters
          let urlHex = pattern.hex;
          let pos = index + pattern.hex.length;
          
          // Read until we hit a null byte or reach end of reasonable URL length
          while (pos < hexStr.length - 1 && (pos - index) / 2 < 500) {
            const byte = hexStr.substring(pos, pos + 2);
            if (byte === '00' || byte === '0d' || byte === '0a') {
              break; // Stop at null, CR, or LF
            }
            urlHex += byte;
            pos += 2;
          }
          
          try {
            const url = Buffer.from(urlHex, 'hex').toString('utf-8');
            const cleanUrl = url.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
            if (cleanUrl.length > 5) {
              const finalUrl = pattern.prefix + cleanUrl.substring(pattern.hex.length / 2);
              console.log(`[Worker] Constructed URL: ${finalUrl}`);
              return finalUrl;
            }
          } catch (e) {
            console.log(`[Worker] Failed to decode pattern ${pattern.name}:`, e);
          }
        }
      }

      // Fallback: look for any text that looks like a URL in the decoded string
      asciiStr = asciiStr.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ');
      console.log(`[Worker] Cleaned ASCII: ${asciiStr.substring(0, 300)}`);
      
      const urlPatterns = [
        /https?:\/\/[^\s]+/i,
        /open\.spotify\.com[^\s]*/i,
        /www\.[^\s]+/i,
      ];

      for (const pattern of urlPatterns) {
        const match = asciiStr.match(pattern);
        if (match) {
          let url = match[0];
          // Clean up any trailing spaces or special chars
          url = url.replace(/[\s]/g, '').trim();
          if (url.length > 5 && !url.includes('%') && url.match(/\w/)) {
            console.log(`[Worker] Extracted URL via regex: ${url}`);
            return url;
          }
        }
      }

      console.log(`[Worker] No URL pattern found in raw data`);
    } catch (e: any) {
      console.log(`[Worker] Raw data extraction error: ${e.message}`);
    }
    return null;
  }
}

try {
  console.log('[Worker] Attempting to load nfc-pcsc...');
  const { NFC } = require('nfc-pcsc');
  
  console.log('[Worker] Creating NFC instance...');
  const nfc = new NFC();
  
  console.log('[Worker] NFC instance created, sending ready message');
  if (process.send) process.send({ type: 'ready' });

  let readerCount = 0;

  nfc.on('reader', (reader: any) => {
    readerCount++;
    console.log(`[Worker] Reader ${readerCount} connected: ${reader.name}`);
    console.log(`[Worker] Reader object available: ${!!reader}`);
    console.log(`[Worker] Reader transmit function available: ${typeof reader.transmit === 'function'}`);
    if (process.send) process.send({ type: 'reader:connect', data: { name: reader.name, connected: true } });

    // Wrap the transmit function to log all commands and responses
    const originalTransmit = reader.transmit.bind(reader);
    reader.transmit = async (apdu: Buffer, responseLength: number) => {
      console.log(`[Worker] >>> APDU Command: ${apdu.toString('hex')} (${apdu.length} bytes)`);
      try {
        const response = await originalTransmit(apdu, responseLength);
        const status = response && response.length >= 2 ? response.slice(-2).toString('hex') : 'no-response';
        console.log(`[Worker] <<< APDU Response: ${response ? response.toString('hex') : 'empty'} [Status: ${status}]`);
        return response;
      } catch (error: any) {
        console.log(`[Worker] !!! APDU Error: ${error.message}`);
        throw error;
      }
    };

    reader.on('card', (card: any) => {
      console.log(`[Worker] Card detected on ${reader.name}: ${card.uid}`);
      
      let cardData: any = {
        reader: reader.name,
        uid: card.uid,
        atr: card.atr.toString('hex'),
        url: null as string | null,
        canWrite: true // Indicate that this tag can be written to
      };

      // Check if we're in write mode waiting for this card
      const currentWriteRequest = (process as any).nfcWriteRequest;
      
      if (currentWriteRequest && currentWriteRequest.active) {
        // We're waiting to write to a card
        console.log(`[Worker] Write request pending, attempting to write URL to card...`);

        const tryWriteCard = async () => {
          try {
            if (reader.transmit) {
              const { url } = currentWriteRequest;

              // FIRST: Read the card to check if it already has data
              console.log(`[Worker] Checking if card already has data...`);
              let existingUrl: string | null = null;
              let allData = Buffer.alloc(0);

              // Try to read existing data
              try {
                for (let block = 4; block <= 20; block++) {
                  try {
                    const readCommand = Buffer.from([0xFF, 0xB0, 0x00, block, 0x10]);
                    const response = await reader.transmit(readCommand, 32);

                    if (response && response.length > 2) {
                      const data = response.slice(0, response.length - 2);
                      allData = Buffer.concat([allData, data]);
                    }
                  } catch (e: any) {
                    break;
                  }
                }

                // Parse existing data if found
                if (allData.length > 0) {
                  const result = NDEFParser.parseNDEF(allData);
                  existingUrl = result.url;

                  if (existingUrl) {
                    console.log(`[Worker] Card already contains: ${existingUrl}`);

                    // Check if it's a pet profile URL (contains /pet/)
                    if (existingUrl.includes('/pet/')) {
                      console.log(`[Worker] Card already has a valid pet record - NOT overwriting`);
                      cardData.url = existingUrl;
                      cardData.writeSuccess = true;
                      cardData.message = 'Card already contains a pet record - preserved existing data';
                    } else {
                      console.log(`[Worker] Card has different data, but no pet record - overwriting...`);
                      const ndefRecord = NDEFWriter.createURIRecord(url);
                      const success = await NDEFWriter.writeToTag(reader, ndefRecord);

                      if (success) {
                        cardData.url = url;
                        cardData.writeSuccess = true;
                        cardData.message = 'Overwrote non-pet data with new pet record';
                      } else {
                        cardData.writeSuccess = false;
                        cardData.message = 'Failed to overwrite card';
                      }
                    }
                  } else {
                    console.log(`[Worker] Card appears to be empty - writing new data...`);
                    const ndefRecord = NDEFWriter.createURIRecord(url);
                    const success = await NDEFWriter.writeToTag(reader, ndefRecord);

                    if (success) {
                      cardData.url = url;
                      cardData.writeSuccess = true;
                      cardData.message = 'Successfully wrote new pet record';
                    } else {
                      cardData.writeSuccess = false;
                      cardData.message = 'Failed to write to card';
                    }
                  }
                } else {
                  console.log(`[Worker] Card appears to be empty - writing new data...`);
                  const ndefRecord = NDEFWriter.createURIRecord(url);
                  const success = await NDEFWriter.writeToTag(reader, ndefRecord);

                  if (success) {
                    cardData.url = url;
                    cardData.writeSuccess = true;
                    cardData.message = 'Successfully wrote new pet record';
                  } else {
                    cardData.writeSuccess = false;
                    cardData.message = 'Failed to write to card';
                  }
                }
              } catch (readError: any) {
                console.log(`[Worker] Error reading card before write: ${readError.message}`);
                // If read fails, still attempt to write
                const ndefRecord = NDEFWriter.createURIRecord(url);
                const success = await NDEFWriter.writeToTag(reader, ndefRecord);

                if (success) {
                  cardData.url = url;
                  cardData.writeSuccess = true;
                  cardData.message = 'Successfully wrote pet record';
                } else {
                  cardData.writeSuccess = false;
                  cardData.message = 'Failed to write to card';
                }
              }
            }
          } catch (e: any) {
            console.log(`[Worker] Card write error: ${e.message}`);
            cardData.writeSuccess = false;
            cardData.message = `Write error: ${e.message}`;
          }

          // Send the card data
          if (process.send) {
            process.send({
              type: 'card:write-complete',
              data: cardData,
            });
          }

          // Clear write request after completion
          (process as any).nfcWriteRequest = null;
        };

        tryWriteCard().catch(err => {
          console.log(`[Worker] Async write failed: ${err.message}`);
          cardData.writeSuccess = false;
          cardData.message = `Async error: ${err.message}`;
          if (process.send) {
            process.send({
              type: 'card:write-complete',
              data: cardData,
            });
          }
          (process as any).nfcWriteRequest = null;
        });
      } else {
        // Normal read mode
        const tryReadCard = async () => {
          try {
            if (reader.transmit) {
              console.log(`[Worker] Attempting to read NDEF data...`);
              
              let allData = Buffer.alloc(0);
              
              // Read blocks 4-20 where NDEF data is stored on NTAG cards
              for (let block = 4; block <= 20; block++) {
                try {
                  // MIFARE Read Block command: FF B0 00 <block> 10 (read 16 bytes)
                  const readCommand = Buffer.from([0xFF, 0xB0, 0x00, block, 0x10]);
                  const response = await reader.transmit(readCommand, 32);
                  
                  if (response && response.length > 2) {
                    const data = response.slice(0, response.length - 2);
                    
                    console.log(`[Worker] Block ${block}: ${data.toString('hex')}`);
                    allData = Buffer.concat([allData, data]);
                  }
                } catch (e: any) {
                  console.log(`[Worker] Error reading block ${block}: ${e.message}`);
                  break;
                }
              }

              console.log(`[Worker] Total data length: ${allData.length}, data: ${allData.toString('hex')}`);
              
              // Parse NDEF from the raw data
              if (allData.length > 0) {
                const result = NDEFParser.parseNDEF(allData);
                if (result.url) {
                  cardData.url = result.url;
                  console.log(`[Worker] Successfully extracted URL from NDEF: ${cardData.url}`);
                } else {
                  // Fallback: try to extract URL from raw ASCII data
                  console.log(`[Worker] NDEF parsing did not find URL, trying raw data extraction...`);
                  const rawUrl = NDEFParser.extractURLFromRawData(allData);
                  if (rawUrl) {
                    cardData.url = rawUrl;
                    console.log(`[Worker] Successfully extracted URL from raw data: ${cardData.url}`);
                  } else {
                    console.log(`[Worker] Could not extract URL from either NDEF or raw data`);
                  }
                }
              }
            }
          } catch (e: any) {
            console.log(`[Worker] Card read error: ${e.message}`);
          }

          // Send the card data regardless of read success
          if (process.send) {
            console.log(`[Worker] Sending card event with data:`, cardData);
            process.send({
              type: 'card',
              data: cardData,
            });
          }
        };

        tryReadCard().catch(err => {
          console.log(`[Worker] Async read failed: ${err.message}`);
          if (process.send) {
            process.send({
              type: 'card',
              data: cardData,
            });
          }
        });
      }
    });

    reader.on('card.off', (card: any) => {
      console.log(`[Worker] Card removed from ${reader.name}: ${card.uid}`);
      if (process.send) process.send({
        type: 'card:remove',
        data: { reader: reader.name, uid: card.uid },
      });
    });

    reader.on('error', (err: Error) => {
      console.error(`[Worker] Reader error on ${reader.name}:`, err.message);
      if (process.send) process.send({ type: 'error', data: err.message });
    });

    reader.on('end', () => {
      console.log(`[Worker] Reader disconnected: ${reader.name}`);
      if (process.send) process.send({ type: 'reader:disconnect', data: { name: reader.name, connected: false } });
    });
  });

  nfc.on('error', (err: Error) => {
    console.error('[Worker] NFC error:', err.message);
    console.error('[Worker] Full error:', err);
    if (process.send) process.send({ type: 'error', data: err.message });
  });

  // Log if no readers detected after 3 seconds
  setTimeout(() => {
    if (readerCount === 0) {
      console.log('[Worker] No readers detected after 3 seconds. Waiting for readers to connect...');
    }
  }, 3000);

  // Listen for write requests from parent process
  if (process.on) {
    process.on('message', (msg: any) => {
      console.log('[Worker] Received message from parent:', msg.type);
      
      if (msg.type === 'write-request') {
        const { url } = msg.data;
        console.log(`[Worker] Write request received: write ${url} to next card`);
        
        // Set write mode
        (process as any).nfcWriteRequest = {
          active: true,
          url: url,
          timestamp: Date.now()
        };
        
        console.log('[Worker] Write mode activated. Waiting for card...');
      }
    });
  }

} catch (err: any) {
  console.error('[Worker] Failed to initialize NFC:', err.message);
  console.error('[Worker] Full error:', err);
  if (process.send) process.send({ type: 'init-failed', data: err.message });
  process.exit(1);
}
