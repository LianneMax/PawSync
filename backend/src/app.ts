/**
 * Express application factory.
 * Kept separate from server.ts so the app can be imported by tests without
 * triggering database connections, NFC hardware, or WebSocket setup.
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import authRoutes from './routes/authRoutes';
import petRoutes from './routes/petRoutes';
import userRoutes from './routes/userRoutes';
import nfcRoutes from './routes/nfcRoutes';
import clinicRoutes from './routes/clinicRoutes';
import verificationRoutes from './routes/verificationRoutes';
import vetApplicationRoutes from './routes/vetApplicationRoutes';
import medicalRecordRoutes from './routes/medicalRecordRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import vetScheduleRoutes from './routes/vetScheduleRoutes';
import vaccinationRoutes from './routes/vaccinationRoutes';
import vaccineTypeRoutes from './routes/vaccineTypeRoutes';
import confinementRoutes from './routes/confinementRoutes';
import billingRoutes from './routes/billingRoutes';
import productServiceRoutes from './routes/productServiceRoutes';
import paymentQRRoutes from './routes/paymentQRRoutes';
import notificationRoutes from './routes/notificationRoutes';
import petNotesRoutes from './routes/petNotesRoutes';
import vetReportRoutes from './routes/vetReportRoutes';
import resignationRoutes from './routes/resignationRoutes';
import referralRoutes from './routes/referralRoutes';
import vetLeaveRoutes from './routes/vetLeaveRoutes';
import uploadRoutes from './routes/uploadRoutes';

export function createApp() {
  const app = express();

  const allowedOrigins = new Set<string>([
    process.env.FRONTEND_URL || 'https://pawsync.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
  }));

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve uploaded files as static assets
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'PawSync API is running' });
  });

  app.use('/api/upload', uploadRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/pets', petRoutes);
  app.use('/api/clinics', clinicRoutes);
  app.use('/api/verifications', verificationRoutes);
  app.use('/api/vet-applications', vetApplicationRoutes);
  app.use('/api/medical-records', medicalRecordRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/vet-schedule', vetScheduleRoutes);
  app.use('/api/vaccinations', vaccinationRoutes);
  app.use('/api/vaccine-types', vaccineTypeRoutes);
  app.use('/api/confinement', confinementRoutes);
  app.use('/api/billings', billingRoutes);
  app.use('/api/product-services', productServiceRoutes);
  app.use('/api/payment-qr', paymentQRRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/pet-notes', petNotesRoutes);
  app.use('/api/vet-reports', vetReportRoutes);
  app.use('/api/resignations', resignationRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/vet-leave', vetLeaveRoutes);
  app.use('/api/nfc', nfcRoutes);

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'ERROR',
      message: `Route ${req.method} ${req.url} not found`,
    });
  });

  return app;
}
