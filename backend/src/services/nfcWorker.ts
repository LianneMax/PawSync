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
    if (process.send) process.send({ type: 'reader:connect', data: { name: reader.name, connected: true } });

    reader.on('card', (card: any) => {
      console.log(`[Worker] Card detected on ${reader.name}: ${card.uid}`);
      
      let cardData = {
        reader: reader.name,
        uid: card.uid,
        atr: card.atr.toString('hex'),
        url: null as string | null
      };

      // Try to read NDEF data from the card
      const tryReadCard = async () => {
        try {
          if (reader.transmit) {
            console.log(`[Worker] Attempting to read NDEF data...`);
            
            let allHexData = '';
            
            // Read blocks 4-20 where NDEF data is stored on NTAG cards
            for (let block = 4; block <= 20; block++) {
              try {
                // MIFARE Read Block command: FF B0 00 <block> 10 (read 16 bytes)
                const readCommand = Buffer.from([0xFF, 0xB0, 0x00, block, 0x10]);
                const response = await reader.transmit(readCommand, 32);
                
                if (response && response.length > 2) {
                  const data = response.slice(0, response.length - 2);
                  const hexStr = data.toString('hex');
                  
                  console.log(`[Worker] Block ${block}: ${hexStr}`);
                  allHexData += hexStr;
                }
              } catch (e: any) {
                console.log(`[Worker] Error reading block ${block}: ${e.message}`);
                break;
              }
            }

            console.log(`[Worker] Total hex data length: ${allHexData.length}, data: ${allHexData}`);
            
            // Search for "https://" in hex: 68747470733a2f2f
            const httpsHex = '68747470733a2f2f';
            const httpsIndex = allHexData.indexOf(httpsHex);
            
            if (httpsIndex !== -1) {
              console.log(`[Worker] Found https:// at hex position ${httpsIndex}`);
              
              // Start from "h" (68) and continue until we hit a null byte (00) or unlikely characters
              let urlHex = httpsHex;
              let pos = httpsIndex + httpsHex.length;
              
              // Read hex pairs (2 chars = 1 byte) until null byte or end
              while (pos < allHexData.length - 1) {
                const hexByte = allHexData.substring(pos, pos + 2);
                if (hexByte === '00') {
                  // Stop at null terminator
                  console.log(`[Worker] Found null terminator at hex position ${pos}`);
                  break;
                }
                urlHex += hexByte;
                pos += 2;
              }
              
              // Convert hex to ASCII string
              try {
                const urlBuffer = Buffer.from(urlHex, 'hex');
                cardData.url = urlBuffer.toString('ascii', 0, urlBuffer.length).trim();
                console.log(`[Worker] Extracted URL: ${cardData.url}`);
              } catch (e: any) {
                console.log(`[Worker] Failed to convert hex to string: ${e.message}`);
              }
            } else {
              console.log(`[Worker] "https://" pattern not found in hex data`);
              
              // As fallback, look for "http://" instead
              const httpHex = '687474703a2f2f';
              const httpIndex = allHexData.indexOf(httpHex);
              if (httpIndex !== -1) {
                console.log(`[Worker] Found http:// at position ${httpIndex}`);
                let urlHex = httpHex;
                let pos = httpIndex + httpHex.length;
                while (pos < allHexData.length - 1) {
                  const hexByte = allHexData.substring(pos, pos + 2);
                  if (hexByte === '00') break;
                  urlHex += hexByte;
                  pos += 2;
                }
                const urlBuffer = Buffer.from(urlHex, 'hex');
                cardData.url = urlBuffer.toString('ascii', 0, urlBuffer.length).trim();
                console.log(`[Worker] Extracted URL: ${cardData.url}`);
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

} catch (err: any) {
  console.error('[Worker] Failed to initialize NFC:', err.message);
  console.error('[Worker] Full error:', err);
  if (process.send) process.send({ type: 'init-failed', data: err.message });
  process.exit(1);
}
