import http from 'http';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { createApp } from './app';
import { nfcService } from './services/nfcService';
import { initNfcWebSocket } from './websocket/nfcWebSocket';
import { startScheduler } from './utils/scheduler';
import { backfillAssignedVets } from './utils/backfillAssignedVets';
import { ensureNfcTagProduct } from './utils/seedSystemProducts';

// Load environment variables
dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 5001;

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDatabase();
    await backfillAssignedVets();
    await ensureNfcTagProduct();
    startScheduler();

    const server = http.createServer(app);

    // Initialize NFC WebSocket (real-time card/reader events)
    initNfcWebSocket(server);

    // Render sets RENDER=true automatically in all services.
    // USB hardware is never available in cloud VMs — skip the worker fork.
    // NFC_MODE=remote can also be set explicitly for other cloud providers.
    const isCloud = !!process.env.RENDER || process.env.NFC_MODE === 'remote';
    if (!isCloud) {
      nfcService.init();
    } else {
      console.log('🔌 Cloud environment detected — NFC hardware managed by local NFC agent');
    }

    server.listen(PORT, () => {
      console.log('🚀 ================================');
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🚀 NFC WebSocket at ws://localhost:${PORT}/ws/nfc`);
      console.log('🚀 ================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer()