import { NFC, Reader } from 'nfc-pcsc';
import { EventEmitter } from 'events';

export interface NfcReader {
  name: string;
  connected: boolean;
}

export interface NfcCardEvent {
  reader: string;
  uid: string;
  atr: string;
}

class NfcService extends EventEmitter {
  private nfc: NFC | null = null;
  private readers: Map<string, Reader> = new Map();
  private initialized = false;

  init() {
    if (this.initialized) return;

    this.nfc = new NFC();
    this.initialized = true;

    this.nfc.on('reader', (reader: Reader) => {
      console.log(`[NFC] Reader connected: ${reader.name}`);
      this.readers.set(reader.name, reader);
      this.emit('reader:connect', { name: reader.name, connected: true });

      reader.on('card', (card: { uid: string; atr: Buffer }) => {
        const event: NfcCardEvent = {
          reader: reader.name,
          uid: card.uid,
          atr: card.atr.toString('hex'),
        };
        console.log(`[NFC] Card detected on ${reader.name}: ${card.uid}`);
        this.emit('card', event);
      });

      reader.on('card.off', (card: { uid: string }) => {
        console.log(`[NFC] Card removed from ${reader.name}: ${card.uid}`);
        this.emit('card:remove', { reader: reader.name, uid: card.uid });
      });

      reader.on('error', (err: Error) => {
        console.error(`[NFC] Reader error (${reader.name}):`, err.message);
        this.emit('reader:error', { reader: reader.name, error: err.message });
      });

      reader.on('end', () => {
        console.log(`[NFC] Reader disconnected: ${reader.name}`);
        this.readers.delete(reader.name);
        this.emit('reader:disconnect', { name: reader.name, connected: false });
      });
    });

    this.nfc.on('error', (err: Error) => {
      console.error('[NFC] Service error:', err.message);
      this.emit('error', err);
    });

    console.log('[NFC] Service initialized — waiting for readers...');
  }

  getReaders(): NfcReader[] {
    return Array.from(this.readers.entries()).map(([name]) => ({
      name,
      connected: true,
    }));
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const nfcService = new NfcService();
