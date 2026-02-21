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

    const workerPath = path.join(__dirname, 'nfcWorker.ts');

    try {
      console.log('[NFC] Starting NFC worker process...');
      this.worker = fork(workerPath, [], { 
        silent: true,
        execArgv: ['--require', 'ts-node/register']
      });
      
      if (this.worker.stdout) {
        this.worker.stdout.on('data', (data: any) => {
          console.log(data.toString().trim());
        });
      }
      if (this.worker.stderr) {
        this.worker.stderr.on('data', (data: any) => {
          console.error(data.toString().trim());
        });
      }
    } catch {
      console.log('[NFC] Could not start NFC worker — NFC features disabled');
      return;
    }

    const initTimeout = setTimeout(() => {
      if (this.worker) {
        console.log('[NFC] Initialization timeout — NFC worker may not have hardware support');
        this.worker.kill();
        this.worker = null;
      }
    }, 15000);

    this.worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'ready':
          console.log('[NFC] Service initialized — scanning for readers...');
          break;
        case 'reader:connect':
          clearTimeout(initTimeout);
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
          console.log(`[NFC] Card Details:`);
          console.log(`  - UID: ${msg.data.uid}`);
          console.log(`  - ATR: ${msg.data.atr}`);
          console.log(`  - Reader: ${msg.data.reader}`);
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
          console.log('[NFC] Error details:', msg.data);
          this.worker?.kill();
          this.worker = null;
          break;
      }
    });

    this.worker.on('exit', () => {
      clearTimeout(initTimeout);
      console.log('[NFC] Worker process exited');
      this.worker = null;
    });

    this.worker.on('error', (err) => {
      clearTimeout(initTimeout);
      console.log('[NFC] Could not start NFC worker — NFC features disabled');
      console.log('[NFC] Error:', err.message);
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
