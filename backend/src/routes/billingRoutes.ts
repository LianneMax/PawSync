import express from 'express';
import {
  createBilling,
  listBillingsForClinic,
  listMyInvoices,
  listBillingsForVet,
  getBillingByMedicalRecord,
  getBillingById,
  updateBilling,
  markBillingAsPaid,
  deleteBillings,
} from '../controllers/billingController';
import {
  authMiddleware,
  clinicOrBranchAdminOnly,
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

// Clinic admin — all billings for their clinic
// GET /api/billings
router.get('/', authMiddleware, clinicOrBranchAdminOnly, listBillingsForClinic);

// Clinic admin — create billing
// POST /api/billings
router.post('/', authMiddleware, clinicOrBranchAdminOnly, createBilling);

// Clinic admin or vet — update billing / vet approval
// PATCH /api/billings/:id
router.patch('/:id', authMiddleware, vetOrClinicAdminOnly, updateBilling);

// Clinic admin — mark billing as paid
// PATCH /api/billings/:id/pay
router.patch('/:id/pay', authMiddleware, clinicOrBranchAdminOnly, markBillingAsPaid);

// Clinic admin — get single billing
// GET /api/billings/:id
router.get('/:id', authMiddleware, getBillingById);

// Clinic admin — bulk delete
// DELETE /api/billings
router.delete('/', authMiddleware, clinicOrBranchAdminOnly, deleteBillings);

export default router;
