/**
 * Persistent file-backed FIFO queue for NFC events.
 *
 * Events are written to disk immediately so they survive process restarts and
 * power failures. The queue is drained (oldest-first) whenever connectivity
 * to the backend is restored.
 *
 * File format: newline-delimited JSON (one event object per line).
 * This avoids loading the whole file into memory and makes it easy to
 * append without rewriting the entire file.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'fs';
import path from 'path';
import { logger } from './logger';

export interface NfcEvent {
  id: string;
  type: string;
  data: unknown;
  timestamp: string;
}

const QUEUE_FILE = path.join(process.cwd(), '.nfc-queue.ndjson');

export class EventQueue {
  private events: NfcEvent[] = [];

  constructor() {
    this.load();
  }

  /** Restore queue from disk on startup. */
  private load(): void {
    try {
      if (!existsSync(QUEUE_FILE)) return;
      const raw = readFileSync(QUEUE_FILE, 'utf-8').trim();
      if (!raw) return;
      this.events = raw
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as NfcEvent);
      if (this.events.length > 0) {
        logger.info(`[Queue] Restored ${this.events.length} queued event(s) from disk`);
      }
    } catch (err: any) {
      logger.error(`[Queue] Failed to load queue from disk: ${err.message}`);
      this.events = [];
    }
  }

  /** Persist the in-memory queue to disk. Full rewrite on pop; append on push. */
  private persist(): void {
    try {
      writeFileSync(QUEUE_FILE, this.events.map((e) => JSON.stringify(e)).join('\n') + (this.events.length ? '\n' : ''));
    } catch (err: any) {
      logger.error(`[Queue] Failed to persist queue: ${err.message}`);
    }
  }

  /** Enqueue an event. Appends to disk without rewriting the whole file. */
  push(event: NfcEvent): void {
    this.events.push(event);
    try {
      appendFileSync(QUEUE_FILE, JSON.stringify(event) + '\n');
    } catch (err: any) {
      logger.error(`[Queue] Append failed, falling back to full rewrite: ${err.message}`);
      this.persist();
    }
    logger.warn(`[Queue] Event queued (queue size: ${this.events.length}): ${event.type}`);
  }

  /** Peek at the oldest event without removing it. */
  peek(): NfcEvent | null {
    return this.events[0] ?? null;
  }

  /** Remove and return the oldest event. */
  pop(): NfcEvent | null {
    const event = this.events.shift() ?? null;
    if (event) this.persist();
    return event;
  }

  size(): number {
    return this.events.length;
  }
}
