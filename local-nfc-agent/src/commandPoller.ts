/**
 * Command poller — polls the backend for pending NFC write commands.
 *
 * Flow:
 *   Admin clicks "Write Tag" in the web app
 *   → Backend creates a NfcCommand doc (status: pending)
 *   → Poller picks it up here
 *   → Sends write-request IPC to nfcWorker
 *   → Worker writes the tag, sends card:write-complete IPC back
 *   → Agent POSTs the result to /api/nfc/commands/:id/result
 *   → Backend updates DB + pushes WebSocket event to frontend
 */

import axios, { AxiosError } from 'axios';
import { ChildProcess } from 'child_process';
import { logger } from './logger';
import { HttpRelay } from './httpRelay';

const BACKEND_URL  = process.env.BACKEND_URL!;
const NFC_SECRET   = process.env.NFC_SECRET!;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 3_000);

const http = axios.create({
  baseURL: BACKEND_URL,
  timeout: 8_000,
  headers: { 'Content-Type': 'application/json', 'x-nfc-secret': NFC_SECRET },
});

export interface PendingCommand {
  _id: string;
  petId: string;
  url: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
}

export class CommandPoller {
  private worker: ChildProcess | null = null;
  private relay: HttpRelay;
  private activeCommandId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(relay: HttpRelay) {
    this.relay = relay;
  }

  /** Call this after the worker process is (re)started. */
  setWorker(worker: ChildProcess): void {
    this.worker = worker;
  }

  start(): void {
    if (this.timer) return;
    logger.info(`[Poller] Starting — polling every ${POLL_INTERVAL}ms`);
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Called by index.ts when the worker sends card:write-complete IPC message. */
  async onWriteComplete(data: {
    uid: string;
    writeSuccess: boolean;
    url?: string;
    message?: string;
  }): Promise<void> {
    if (!this.activeCommandId) return;
    const commandId = this.activeCommandId;
    this.activeCommandId = null;

    logger.info(`[Poller] Write complete for command ${commandId}: success=${data.writeSuccess}`);
    await this.relay.sendCommandResult(commandId, data);
  }

  private async poll(): Promise<void> {
    // Don't fetch new commands while one is in progress
    if (this.activeCommandId || !this.worker) return;

    try {
      const { data } = await http.get<{ data: PendingCommand[] }>(
        '/api/nfc/commands/pending'
      );
      const commands = data?.data ?? [];
      if (commands.length === 0) return;

      const cmd = commands[0];
      logger.info(`[Poller] Picked up command ${cmd._id} — writing URL: ${cmd.url}`);

      this.activeCommandId = cmd._id;

      // Tell worker to enter write mode for this URL
      this.worker.send({ type: 'write-request', data: { url: cmd.url } });
    } catch (err) {
      const axErr = err as AxiosError;
      // Suppress noise when backend is temporarily unreachable
      if (!axErr.response) {
        logger.debug(`[Poller] Backend unreachable: ${axErr.message}`);
      } else {
        logger.error(`[Poller] Poll error ${axErr.response.status}: ${axErr.message}`);
      }
    }
  }
}
