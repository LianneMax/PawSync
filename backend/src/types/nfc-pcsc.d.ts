declare module 'nfc-pcsc' {
  import { EventEmitter } from 'events';

  export class NFC extends EventEmitter {
    on(event: 'reader', listener: (reader: Reader) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export class Reader extends EventEmitter {
    name: string;
    on(event: 'card', listener: (card: { uid: string; atr: Buffer }) => void): this;
    on(event: 'card.off', listener: (card: { uid: string }) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }
}
