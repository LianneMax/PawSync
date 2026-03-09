import express from 'express';
import { listPaymentQRs, createPaymentQR, deletePaymentQR } from '../controllers/paymentQRController';
import { authMiddleware, clinicOrBranchAdminOnly } from '../middleware/auth';

const router = express.Router();

// GET /api/payment-qr — all authenticated staff
router.get('/', authMiddleware, listPaymentQRs);

// POST /api/payment-qr — clinic/branch admin only
router.post('/', authMiddleware, clinicOrBranchAdminOnly, createPaymentQR);

// DELETE /api/payment-qr/:id — clinic/branch admin only
router.delete('/:id', authMiddleware, clinicOrBranchAdminOnly, deletePaymentQR);

export default router;
