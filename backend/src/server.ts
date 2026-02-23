import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import petRoutes from './routes/petRoutes';
import userRoutes from './routes/userRoutes';
import nfcRoutes from './routes/nfcRoutes';
import clinicRoutes from './routes/clinicRoutes';
import verificationRoutes from './routes/verificationRoutes';
import vetApplicationRoutes from './routes/vetApplicationRoutes';
import medicalRecordRoutes from './routes/medicalRecordRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import { nfcService } from './services/nfcService';
import { initNfcWebSocket } from './websocket/nfcWebSocket';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

<<<<<<< Updated upstream
=======
// CORS configuration - must be first middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://pawsync.onrender.com',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Explicitly handle preflight requests for all routes
app.options('*', cors(corsOptions));

>>>>>>> Stashed changes
// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Manual CORS headers middleware - must be first
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Token, X-API-Key');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Access-Control-Allow-Credentials', 'false');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Apply CORS middleware as backup
const corsOptions = {
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Clinic routes
app.use('/api/clinics', clinicRoutes);

// Verification routes
app.use('/api/verifications', verificationRoutes);

// Vet application routes
app.use('/api/vet-applications', vetApplicationRoutes);

// Medical record routes
app.use('/api/medical-records', medicalRecordRoutes);

// Appointment routes
app.use('/api/appointments', appointmentRoutes);

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

    // Start NFC reader detection (runs in separate process, never blocks server)
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