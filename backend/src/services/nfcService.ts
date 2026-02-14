import { EventEmitter } from 'events';
import { fork, ChildProcess } from 'child_process';
import path from 'path';

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
  private readers: Map<string, boolean> = new Map();
  private initialized = false;
  private worker: ChildProcess | null = null;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const workerPath = path.join(__dirname, 'nfcWorker.js');

    try {
      this.worker = fork(workerPath, [], { silent: true });
    } catch {
      console.log('[NFC] Could not start NFC worker — NFC features disabled');
      return;
    }

    const initTimeout = setTimeout(() => {
      if (this.worker) {
        this.worker.kill();
        this.worker = null;
        console.log('[NFC] No NFC hardware detected — NFC features disabled');
      }
    }, 5000);

    this.worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'ready':
          clearTimeout(initTimeout);
          console.log('[NFC] Service initialized — waiting for readers...');
          break;
        case 'reader:connect':
          console.log(`[NFC] Reader connected: ${msg.data.name}`);
          this.readers.set(msg.data.name, true);
          this.emit('reader:connect', msg.data);
          break;
        case 'reader:disconnect':
          console.log(`[NFC] Reader disconnected: ${msg.data.name}`);
          this.readers.delete(msg.data.name);
          this.emit('reader:disconnect', msg.data);
          break;
        case 'card':
          console.log(`[NFC] Card detected on ${msg.data.reader}: ${msg.data.uid}`);
          this.emit('card', msg.data);
          break;
        case 'card:remove':
          console.log(`[NFC] Card removed from ${msg.data.reader}: ${msg.data.uid}`);
          this.emit('card:remove', msg.data);
          break;
        case 'error':
          console.warn('[NFC] Service error:', msg.data);
          break;
        case 'init-failed':
          clearTimeout(initTimeout);
          console.log('[NFC] No NFC hardware detected — NFC features disabled');
          this.worker?.kill();
          this.worker = null;
          break;
      }
    });

    this.worker.on('exit', () => {
      clearTimeout(initTimeout);
      this.worker = null;
    });

    this.worker.on('error', () => {
      clearTimeout(initTimeout);
      console.log('[NFC] Could not start NFC worker — NFC features disabled');
      this.worker = null;
    });
  }

  getReaders(): NfcReader[] {
    return Array.from(this.readers.keys()).map((name) => ({
      name,
      connected: true,
    }));
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const nfcService = new NfcService();
