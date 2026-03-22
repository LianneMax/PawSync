import express from 'express';
import {
  createBilling,
  listBillingsForClinic,
  listMyInvoices,
  listBillingsForVet,
  getBillingByMedicalRecord,
  getBillingsByConfinementRecord,
  getBillingById,
  updateBilling,
  markBillingAsPaid,
  submitQrPaymentProof,
  approveQrPayment,
  rejectQrPayment,
  deleteBillings,
} from '../controllers/billingController';
import {
  authMiddleware,
  clinicAdminOnly,
  veterinarianOnly,
  vetOrClinicAdminOnly,
} from '../middleware/auth';

const router = express.Router();

// Pet owner — their own invoices
// GET /api/billings/my-invoices
router.get('/my-invoices', authMiddleware, listMyInvoices);

// Veterinarian — their billing list
// GET /api/billings/vet
router.get('/vet', authMiddleware, veterinarianOnly, listBillingsForVet);

// Clinic staff — get billing linked to a specific medical record
// GET /api/billings/medical-record/:medicalRecordId
router.get('/medical-record/:medicalRecordId', authMiddleware, vetOrClinicAdminOnly, getBillingByMedicalRecord);

// Clinic staff — get billings linked to a specific confinement record
// GET /api/billings/confinement-record/:confinementRecordId
router.get('/confinement-record/:confinementRecordId', authMiddleware, vetOrClinicAdminOnly, getBillingsByConfinementRecord);

// Clinic admin — all billings for their clinic
// GET /api/billings
router.get('/', authMiddleware, clinicAdminOnly, listBillingsForClinic);

// Clinic admin — create billing
// POST /api/billings
router.post('/', authMiddleware, clinicAdminOnly, createBilling);

// Clinic admin or vet — update billing / vet approval
// PATCH /api/billings/:id
router.patch('/:id', authMiddleware, vetOrClinicAdminOnly, updateBilling);

// Clinic admin — mark billing as paid
// PATCH /api/billings/:id/pay
router.patch('/:id/pay', authMiddleware, clinicAdminOnly, markBillingAsPaid);

// Pet owner — submit QR payment screenshot
// POST /api/billings/:id/submit-qr-proof
router.post('/:id/submit-qr-proof', authMiddleware, submitQrPaymentProof);

// Clinic admin — approve QR payment and mark as paid
// POST /api/billings/:id/approve-qr-payment
router.post('/:id/approve-qr-payment', authMiddleware, clinicAdminOnly, approveQrPayment);

// Clinic admin — reject QR payment so pet owner can re-submit
// POST /api/billings/:id/reject-qr-payment
router.post('/:id/reject-qr-payment', authMiddleware, clinicAdminOnly, rejectQrPayment);

// Clinic admin — get single billing
// GET /api/billings/:id
router.get('/:id', authMiddleware, getBillingById);

// Clinic admin — bulk delete
// DELETE /api/billings
router.delete('/', authMiddleware, clinicAdminOnly, deleteBillings);

export default router;
