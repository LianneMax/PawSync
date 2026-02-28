/**
 * PawSync Local NFC Agent
 *
 * Runs on the admin computer. Forks nfcWorker.ts (USB/PC-SC), receives IPC
 * events, and relays them to the Render backend via HTTPS. Also polls the
 * backend for write commands so the admin can write pet profile URLs to NFC
 * tags from the web UI.
 *
 * Required env vars (see .env.example):
 *   BACKEND_URL   — https://your-render-service.onrender.com
 *   NFC_SECRET    — shared secret (must match backend NFC_SECRET)
 */

import 'dotenv/config';
import { fork, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { EventQueue } from './eventQueue';
import { HttpRelay } from './httpRelay';
import { CommandPoller } from './commandPoller';

// ─── Validate required env vars ───────────────────────────────────────────────

const REQUIRED_VARS = ['BACKEND_URL', 'NFC_SECRET'] as const;
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    logger.error(`[Agent] Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── Singletons ───────────────────────────────────────────────────────────────

const queue  = new EventQueue();
const relay  = new HttpRelay(queue);
const poller = new CommandPoller(relay);

// ─── Worker lifecycle ─────────────────────────────────────────────────────────

let worker:       ChildProcess | null = null;
let restartCount  = 0;
let shuttingDown  = false;

const MAX_RESTARTS   = 10;
const MAX_BACKOFF_MS = 30_000;

function resolveWorkerPath(): string {
  // Prefer compiled JS in dist/ when running via PM2; fall back to ts-node for dev
  const jsPath = path.join(__dirname, 'nfcWorker.js');
  const tsPath = path.join(__dirname, 'nfcWorker.ts');
  return existsSync(jsPath) ? jsPath : tsPath;
}

function startWorker(): void {
  if (shuttingDown) return;

  const workerPath = resolveWorkerPath();
  const execArgv   = workerPath.endsWith('.ts') ? ['--require', 'ts-node/register'] : [];

  logger.info(`[Agent] Spawning NFC worker (restart #${restartCount}): ${workerPath}`);

  worker = fork(workerPath, [], { silent: true, execArgv });
  poller.setWorker(worker);

  // Pipe worker stdout/stderr through our logger
  worker.stdout?.on('data', (buf: Buffer) =>
    logger.debug(`[Worker] ${buf.toString().trim()}`)
  );
  worker.stderr?.on('data', (buf: Buffer) =>
    logger.error(`[Worker] ${buf.toString().trim()}`)
  );

  // ── IPC messages from worker ─────────────────────────────────────────────

  worker.on('message', async (msg: { type: string; data?: unknown }) => {
    switch (msg.type) {
      case 'ready':
        logger.info('[Agent] Worker ready — NFC reader scanning started');
        restartCount = 0; // reset crash counter on successful start
        break;

      case 'init-failed':
        logger.error(`[Agent] Worker NFC init failed: ${msg.data}`);
        // Worker will exit; let the exit handler manage restart
        break;

      case 'write:progress':
        // Forward progress events to backend so frontend WebSocket stays in sync
        await relay.sendEvent(buildEvent('write:progress', msg.data));
        break;

      case 'card:write-complete':
        await relay.sendEvent(buildEvent('card:write-complete', msg.data));
        await poller.onWriteComplete(msg.data as any);
        break;

      default:
        // card, card:remove, reader:connect, reader:disconnect, error
        await relay.sendEvent(buildEvent(msg.type, msg.data));
        break;
    }
  });

  // ── Worker exit / crash handling ─────────────────────────────────────────

  worker.on('exit', (code, signal) => {
    logger.warn(`[Agent] Worker exited — code=${code} signal=${signal}`);
    worker = null;

    if (shuttingDown) return;

    restartCount++;
    if (restartCount > MAX_RESTARTS) {
      logger.error('[Agent] Worker crashed too many times — giving up. Check hardware.');
      process.exit(1);
    }

    const delay = Math.min(1_000 * Math.pow(2, restartCount - 1), MAX_BACKOFF_MS);
    logger.info(`[Agent] Restarting worker in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})`);
    setTimeout(startWorker, delay);
  });

  worker.on('error', (err) => {
    logger.error(`[Agent] Worker spawn error: ${err.message}`);
  });
}

function buildEvent(type: string, data: unknown) {
  return { id: uuidv4(), type, data, timestamp: new Date().toISOString() };
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`[Agent] Received ${signal} — shutting down gracefully...`);

  poller.stop();
  worker?.kill('SIGTERM');

  // Give queued events one last chance to drain
  await relay.drain().catch(() => {});

  logger.info(`[Agent] Shutdown complete. Residual queue size: ${queue.size()}`);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

// ─── Periodic queue drain (re-attempt when back online) ──────────────────────

const DRAIN_INTERVAL = Number(process.env.DRAIN_INTERVAL_MS ?? 30_000);
setInterval(() => relay.drain().catch(() => {}), DRAIN_INTERVAL);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

logger.info('='.repeat(60));
logger.info(' PawSync Local NFC Agent');
logger.info(`  Backend : ${process.env.BACKEND_URL}`);
logger.info(`  Queue   : ${queue.size()} pending event(s)`);
logger.info('='.repeat(60));

poller.start();
startWorker();

// Drain any events left over from a previous run immediately
relay.drain().catch(() => {});
