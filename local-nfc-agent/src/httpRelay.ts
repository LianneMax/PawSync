/**
 * HTTP relay — sends NFC events to the Render backend via HTTPS.
 *
 * Retry strategy: exponential backoff with jitter.
 *   attempt 0 → immediate
 *   attempt 1 → ~1 s
 *   attempt 2 → ~2 s
 *   attempt 3 → ~4 s  (capped at MAX_DELAY)
 *
 * If all retries are exhausted the event is pushed to the persistent
 * EventQueue. A periodic drainer (see index.ts) will retry the queue
 * whenever connectivity is restored.
 */

import axios, { AxiosError } from 'axios';
import { EventQueue, NfcEvent } from './eventQueue';
import { logger } from './logger';

const BACKEND_URL = process.env.BACKEND_URL!;
const NFC_SECRET  = process.env.NFC_SECRET!;

const MAX_RETRIES = 4;
const BASE_DELAY  = 1_000; // ms
const MAX_DELAY   = 16_000; // ms
const TIMEOUT     = 10_000; // ms per request

function jitter(base: number): number {
  return base + Math.floor(Math.random() * 500);
}

function backoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Axios instance shared across all calls ──────────────────────────────────

const http = axios.create({
  baseURL: BACKEND_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'x-nfc-secret': NFC_SECRET,
  },
});

// ─── Core POST with retry ─────────────────────────────────────────────────────

async function postWithRetry(
  path: string,
  body: unknown,
  attempt = 0
): Promise<boolean> {
  try {
    await http.post(path, body);
    return true;
  } catch (err) {
    const axErr = err as AxiosError;
    const status = axErr.response?.status;

    // 4xx client errors are terminal — retrying won't help
    if (status && status >= 400 && status < 500) {
      logger.error(`[Relay] Terminal error ${status} for ${path} — dropping event`);
      return false;
    }

    if (attempt >= MAX_RETRIES) {
      logger.error(`[Relay] Exhausted ${MAX_RETRIES} retries for ${path}: ${axErr.message}`);
      return false;
    }

    const delay = jitter(backoffDelay(attempt));
    logger.warn(`[Relay] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms (${axErr.message})`);
    await sleep(delay);
    return postWithRetry(path, body, attempt + 1);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class HttpRelay {
  private queue: EventQueue;
  private draining = false;

  constructor(queue: EventQueue) {
    this.queue = queue;
  }

  /**
   * Send an NFC event to the backend.
   * Falls back to the persistent queue if all retries fail.
   */
  async sendEvent(event: NfcEvent): Promise<void> {
    const ok = await postWithRetry('/api/nfc/events', event);
    if (ok) {
      logger.info(`[Relay] Sent event: ${event.type} (id=${event.id})`);
      // Backend is reachable — try to drain any backlogged events
      this.drain().catch(() => {});
    } else {
      this.queue.push(event);
    }
  }

  /**
   * Submit a write-command result back to the backend so it can update
   * the NfcCommand document and push a WebSocket event to the frontend.
   */
  async sendCommandResult(commandId: string, result: unknown): Promise<void> {
    const ok = await postWithRetry(`/api/nfc/commands/${commandId}/result`, result);
    if (!ok) {
      logger.error(`[Relay] Failed to send result for command ${commandId}`);
    }
  }

  /**
   * Drain the persistent queue, sending events oldest-first.
   * Stops at the first failure so we don't skip events out of order.
   */
  async drain(): Promise<void> {
    if (this.draining || this.queue.size() === 0) return;
    this.draining = true;
    logger.info(`[Relay] Draining queue (${this.queue.size()} event(s))...`);
    try {
      let event: NfcEvent | null;
      while ((event = this.queue.peek()) !== null) {
        const ok = await postWithRetry('/api/nfc/events', event);
        if (ok) {
          this.queue.pop();
          logger.info(`[Relay] Drained queued event: ${event.type}`);
        } else {
          logger.warn('[Relay] Still offline — stopping drain');
          break;
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
