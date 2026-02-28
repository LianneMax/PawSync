import { EventEmitter } from 'events';
import { fork, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
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

export interface WriteResult {
  uid: string;
  writeSuccess: boolean;
  url?: string;
  message?: string;
}

class NfcService extends EventEmitter {
  private readers: Map<string, boolean> = new Map();
  private initialized = false;
  private worker: ChildProcess | null = null;
  private writeCallbacks: Map<string, (result: WriteResult) => void> = new Map();

  /**
   * Whether a write operation is currently in progress.
   * Prevents concurrent writes which would corrupt NFC data.
   */
  private writeLocked = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const tsWorkerPath = path.join(__dirname, 'nfcWorker.ts');
    const jsWorkerPath = path.join(__dirname, 'nfcWorker.js');
    const workerPath = existsSync(tsWorkerPath) ? tsWorkerPath : jsWorkerPath;
    const execArgv = workerPath.endsWith('.ts') ? ['--require', 'ts-node/register'] : [];

    try {
      console.log('[NFC] Starting NFC worker process...');
      this.worker = fork(workerPath, [], {
        silent: true,
        execArgv,
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

    this.worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'ready':
          console.log('[NFC] Service initialized — scanning for readers...');
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

        case 'write:progress':
          // Forward write progress events (waiting, writing, verifying)
          console.log(`[NFC] Write progress: ${msg.data.stage}`);
          this.emit('write:progress', msg.data);
          break;

        case 'card:write-complete':
          console.log(`[NFC] Card write completed: ${msg.data.uid} (success: ${msg.data.writeSuccess})`);
          this.emit('card:write-complete', msg.data);

          // Resolve the pending write promise
          const callback = this.writeCallbacks.get('pending-write');
          if (callback) {
            callback(msg.data);
            this.writeCallbacks.delete('pending-write');
          }

          // Release the write lock
          this.writeLocked = false;
          break;

        case 'card:remove':
          console.log(`[NFC] Card removed from ${msg.data.reader}: ${msg.data.uid}`);
          this.emit('card:remove', msg.data);
          break;

        case 'error':
          console.warn('[NFC] Service error:', msg.data);
          break;

        case 'init-failed':
          console.log('[NFC] No NFC hardware detected — NFC features disabled');
          console.log('[NFC] Error details:', msg.data);
          this.worker?.kill();
          this.worker = null;
          break;
      }
    });

    this.worker.on('exit', () => {
      console.log('[NFC] Worker process exited');
      this.worker = null;
      // Release lock if worker crashes mid-write
      this.writeLocked = false;
    });

    this.worker.on('error', (err) => {
      console.log('[NFC] Could not start NFC worker — NFC features disabled');
      console.log('[NFC] Error:', err.message);
      this.worker = null;
      this.writeLocked = false;
    });
  }

  getReaders(): NfcReader[] {
    return Array.from(this.readers.keys()).map((name) => ({
      name,
      connected: true,
    }));
  }

  isInitialized(): boolean {
    // In cloud environments the local NFC agent manages the hardware.
    // Report initialized when at least one reader has checked in via the agent.
    const isCloud = !!process.env.RENDER || process.env.NFC_MODE === 'remote';
    if (isCloud) {
      return this.readers.size > 0;
    }
    return this.initialized && this.worker !== null;
  }

  /**
   * Update the readers map directly — used in NFC_MODE=remote when the
   * local agent reports reader connect/disconnect via POST /api/nfc/events.
   */
  trackReader(name: string, connected: boolean): void {
    if (connected) {
      this.readers.set(name, true);
    } else {
      this.readers.delete(name);
    }
  }

  /** True only when a live child worker process is attached. */
  isWorkerRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Check if a write operation is currently in progress.
   * Use this to prevent concurrent writes from the API layer.
   */
  isWriting(): boolean {
    return this.writeLocked;
  }

  /**
   * Request to write a URL to the next NFC tag that is placed on the reader.
   *
   * Flow:
   * 1. Acquires write lock (rejects if another write is in progress)
   * 2. Sends write-request message to the worker child process
   * 3. Worker enters "write mode" — waits for a card to be tapped
   * 4. When card detected, worker writes NDEF URI record to the tag
   * 5. Worker sends card:write-complete message back
   * 6. Promise resolves with the write result
   *
   * @param url - The URL to encode as an NDEF URI record on the tag
   * @param timeoutMs - Max time to wait for a tag (default 60s)
   * @returns WriteResult with uid, writeSuccess, and optional message
   */
  async writeURLToTag(url: string, timeoutMs: number = 60000): Promise<WriteResult> {
    // Prevent concurrent writes — only one write at a time
    if (this.writeLocked) {
      throw new Error('Another write operation is already in progress. Please wait.');
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('NFC service not initialized — no worker process'));
        return;
      }

      // Acquire the write lock
      this.writeLocked = true;

      // Emit progress event so WebSocket clients know we're waiting
      this.emit('write:progress', { stage: 'waiting', url });

      const timeoutId = setTimeout(() => {
        this.writeCallbacks.delete('pending-write');
        this.writeLocked = false;
        this.emit('write:progress', { stage: 'timeout', url });
        reject(new Error('NFC write timeout — no tag detected within the time limit'));
      }, timeoutMs);

      // Register callback for when the worker completes the write
      this.writeCallbacks.set('pending-write', (result: WriteResult) => {
        clearTimeout(timeoutId);
        resolve(result);
        // writeLocked is released in the message handler above
      });

      // Tell the worker to enter write mode
      console.log(`[NFC] Sending write request to worker for URL: ${url}`);
      this.worker.send({
        type: 'write-request',
        data: { url },
      });
    });
  }
}

export const nfcService = new NfcService();
