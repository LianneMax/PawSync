import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database';
import testRoutes from './routes/testRoutes';
import authRoutes from './routes/authRoutes';
import petRoutes from './routes/petRoutes';
import userRoutes from './routes/userRoutes';
import nfcRoutes from './routes/nfcRoutes';
import { nfcService } from './services/nfcService';
import { initNfcWebSocket } from './websocket/nfcWebSocket';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'PawSync API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// User routes
app.use('/api/users', userRoutes);

// Pet routes
app.use('/api/pets', petRoutes);

// Test routes
app.use('/api/test', testRoutes);

// NFC routes
app.use('/api/nfc', nfcRoutes);

// 404 handler - must be after all routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    status: 'ERROR', 
    message: `Route ${req.method} ${req.url} not found` 
  });
});

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDatabase();

    const server = http.createServer(app);

    // Initialize NFC WebSocket (real-time card/reader events)
    initNfcWebSocket(server);

    // Start NFC reader detection
    nfcService.init();

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

startServer();