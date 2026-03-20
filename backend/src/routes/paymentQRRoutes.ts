import express from 'express';
import { listPaymentQRs, createPaymentQR, updatePaymentQR, deletePaymentQR } from '../controllers/paymentQRController';
import { authMiddleware, clinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// GET /api/payment-qr — all authenticated staff
router.get('/', authMiddleware, listPaymentQRs);

// POST /api/payment-qr — clinic/branch admin only
router.post('/', authMiddleware, clinicAdminOnly, createPaymentQR);

// PATCH /api/payment-qr/:id — clinic/branch admin only
router.patch('/:id', authMiddleware, clinicAdminOnly, updatePaymentQR);

// DELETE /api/payment-qr/:id — clinic/branch admin only
router.delete('/:id', authMiddleware, clinicAdminOnly, deletePaymentQR);

export default router;
