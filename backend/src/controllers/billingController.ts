import { Request, Response } from 'express';
import Billing from '../models/Billing';
import User from '../models/User';
import Clinic from '../models/Clinic';
import MedicalRecord from '../models/MedicalRecord';
import ConfinementRecord from '../models/ConfinementRecord';
import Appointment from '../models/Appointment';
import { sendBillingPaidReceipt } from '../services/emailService';
import { createNotification } from '../services/notificationService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import { syncBillingFromRecord } from './medicalRecordController';
import { generateNextInvoiceNumber } from '../services/invoiceNumberService';
import { generateBillingReceiptPdf, ReceiptLayout } from '../services/billingPdfService';

const APPT_TYPE_DISPLAY: Record<string, string> = {
  'consultation':             'General Consultation',
  'general-checkup':          'General Checkup',
  'primary-treatment':        'Primary Treatment',
  'outpatient-treatment':     'Outpatient Treatment',
  'inpatient-care':           'Inpatient Care',
  'point-of-care-diagnostic': 'Point of Care Diagnostic',
  'laser-therapy':            'Laser Therapy',
  'dental-scaling':           'Dental Scaling',
  'cbc':                      'CBC Test',
  'blood-chemistry-16':       'Blood Chemistry (16)',
  'pcr-test':                 'PCR Test',
  'x-ray':                    'X-Ray',
  'ultrasound':               'Ultrasound',
  'abdominal-surgery':        'Abdominal Surgery',
  'orthopedic-surgery':       'Orthopedic Surgery',
  'vaccination':              'Vaccination',
  'rabies-vaccination':       'Rabies Vaccination',
  'deworming':                'Deworming',
  'flea-tick-prevention':     'Flea & Tick Prevention',
  'basic-grooming':           'Basic Grooming',
  'full-grooming':            'Full Grooming',
};

function formatAppointmentTypesForServiceLabel(types: string[] = []): string {
  if (!Array.isArray(types) || types.length === 0) return '';

  return types
    .map((type) =>
      APPT_TYPE_DISPLAY[type] ||
      type
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    )
    .join(', ');
}

// Populate fields shared across all views
const POPULATE_BILLING = [
  { path: 'ownerId', select: 'firstName lastName email' },
  { path: 'petId', select: 'name species breed' },
  { path: 'vetId', select: 'firstName lastName userType' },
  {
    path: 'clinicId',
    select: 'name legalBusinessName address phone email businessTaxId businessRegistrationNo receiptFooterNote logo',
  },
  { path: 'clinicBranchId', select: 'name address city province phone email' },
  { path: 'medicalRecordId', select: 'stage vetId' },
  { path: 'confinementRecordId', select: 'status admissionDate dischargeDate' },
];

const getMedicalRecordIdFromBilling = (billing: any): string | null => {
  if (!billing?.medicalRecordId) return null;
  if (typeof billing.medicalRecordId === 'string') return billing.medicalRecordId;
  if (billing.medicalRecordId?._id) return billing.medicalRecordId._id.toString();
  return billing.medicalRecordId.toString();
};

const refreshBillingIfNeeded = async (billing: any) => {
  try {
    if (!billing || billing.status === 'paid') return billing;

    const medicalRecordId = getMedicalRecordIdFromBilling(billing);
    if (!medicalRecordId) return billing;

    await syncBillingFromRecord(medicalRecordId);
    const refreshed = await Billing.findById(billing._id).populate(POPULATE_BILLING);
    return refreshed || billing;
  } catch (error) {
    console.error('[Billing] Auto-refresh on read failed:', error);
    return billing;
  }
};

const refreshBillingsIfNeeded = async (billings: any[] = []) =>
  Promise.all(billings.map((billing) => refreshBillingIfNeeded(billing)));

function computeItemTotal(item: any): number {
  const unitPrice = Number(item?.unitPrice || 0);
  const quantity = Number(item?.quantity || 1);
  const dispenseFee = Number(item?.dispenseFee || 0);
  const injectionFee = Number(item?.injectionFee || 0);
  return unitPrice * quantity + dispenseFee + injectionFee;
}

function computeSubtotal(items: any[] = []): number {
  return items.reduce((sum, item) => sum + computeItemTotal(item), 0);
}

function isReceiptLayout(value: unknown): value is ReceiptLayout {
  return value === 'a4' || value === 'thermal-58' || value === 'thermal-80';
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * POST /api/billings
 * Clinic admin / branch admin — create a new billing record.
 * Body: { ownerId, petId, vetId, clinicBranchId, medicalRecordId?, appointmentId?,
 *         items: [{ productServiceId, name, type, unitPrice }],
 *         discount?, serviceLabel?, serviceDate? }
 */
export const createBilling = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      ownerId,
      petId,
      vetId,
      clinicBranchId,
      medicalRecordId,
      confinementRecordId,
      appointmentId,
      items = [],
      discount = 0,
      serviceLabel,
      serviceDate,
      status,
      birNumber,
    } = req.body;

    if (!ownerId || !petId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId and petId are required' });
    }

    // Idempotency: prevent duplicate billings for the same appointment
    if (appointmentId) {
      const existingBilling = await Billing.findOne({ appointmentId }).populate(POPULATE_BILLING);
      if (existingBilling) {
        return res.status(200).json({
          status: 'SUCCESS',
          message: 'Billing already exists for this appointment',
          data: { billing: existingBilling },
        });
      }
    }

    // Billing always starts as pending_payment; ignore any other incoming status
    const resolvedStatus = 'pending_payment';

    let clinicId = req.user.clinicId;

    // Fall back 1: DB lookup for the admin user
    if (!clinicId) {
      const dbUser = await User.findById(req.user.userId).select('clinicId').lean();
      clinicId = (dbUser as any)?.clinicId?.toString();
    }

    // Fall back 2: derive from the linked medical record (most reliable when admin has record access)
    let linkedRecord: any = null;
    if (!clinicId && medicalRecordId) {
      linkedRecord = await MedicalRecord.findById(medicalRecordId).select('clinicId confinementRecordId').lean();
      clinicId = (linkedRecord as any)?.clinicId?.toString();
    } else if (medicalRecordId) {
      linkedRecord = await MedicalRecord.findById(medicalRecordId).select('confinementRecordId').lean();
    }

    if (!clinicId) {
      return res.status(400).json({ status: 'ERROR', message: 'Clinic information is missing from your account' });
    }

    const resolvedConfinementRecordId =
      confinementRecordId ||
      linkedRecord?.confinementRecordId ||
      null;

    const subtotal = computeSubtotal(items);
    const totalAmountDue = Math.max(0, subtotal - discount);

    // Auto-generate serviceLabel from item names; fall back to appointment types when needed.
    let resolvedLabel = serviceLabel ||
      (items.length > 0 ? items.map((i: any) => i.name).join(', ') : '');
    let resolvedServiceDate = serviceDate || new Date();

    if ((!resolvedLabel || !serviceDate) && appointmentId) {
      const appt = await Appointment.findById(appointmentId).select('types date').lean();
      if (!resolvedLabel && appt?.types?.length) {
        resolvedLabel = formatAppointmentTypesForServiceLabel(appt.types);
      }
      if (!serviceDate && appt?.date) {
        resolvedServiceDate = appt.date;
      }
    }

    const generatedInvoiceNumber = await generateNextInvoiceNumber(clinicId);

    const billing = await Billing.create({
      invoiceNumber: generatedInvoiceNumber,
      issueDateTime: new Date(),
      dueDate: resolvedServiceDate,
      ownerId,
      petId,
      vetId: vetId || null,
      clinicId,
      status: resolvedStatus,
      clinicBranchId: clinicBranchId || req.user.clinicBranchId || null,
      medicalRecordId: medicalRecordId || null,
      confinementRecordId: resolvedConfinementRecordId,
      appointmentId: appointmentId || null,
      items,
      subtotal,
      discount,
      totalAmountDue,
      serviceLabel: resolvedLabel,
      serviceDate: resolvedServiceDate,
      birNumber: birNumber || null,
    });

    // Link billing back to the medical record so the page knows one already exists,
    // then immediately sync billing items from the medical record's current state.
    if (medicalRecordId) {
      await MedicalRecord.findByIdAndUpdate(medicalRecordId, { billingId: billing._id });
      syncBillingFromRecord(medicalRecordId).catch((e) =>
        console.error('[Billing] Background billing sync after create failed:', e),
      );
    }

    if (resolvedConfinementRecordId) {
      await ConfinementRecord.findByIdAndUpdate(resolvedConfinementRecordId, {
        $set: { billingId: billing._id },
      });
    }

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING);

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Billing record created successfully',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Create billing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the billing record' });
  }
};

/**
 * GET /api/billings
 * Clinic admin / branch admin — all billing records for their clinic.
 * Query: ?status=awaiting_approval|pending_payment|paid&search=&page=1&limit=20
 */
export const listBillingsForClinic = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let clinicId = req.user.clinicId;
    console.log('[listBillingsForClinic] userId:', req.user.userId, 'userType:', req.user.userType, 'clinicId from JWT:', clinicId);
    if (!clinicId) {
      const dbUser = await User.findById(req.user.userId).select('clinicId').lean();
      clinicId = (dbUser as any)?.clinicId?.toString();
      console.log('[listBillingsForClinic] clinicId from DB:', clinicId);
    }
    if (!clinicId) {
      return res.status(400).json({ status: 'ERROR', message: 'Clinic information is missing from your account' });
    }

    const { status, search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const query: any = { clinicId };
    if (status) query.status = status;

    console.log('[listBillingsForClinic] querying with:', JSON.stringify(query));
    const [billings, total] = await Promise.all([
      Billing.find(query)
        .populate(POPULATE_BILLING)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Billing.countDocuments(query),
    ]);
    console.log('[listBillingsForClinic] found:', total, 'total,', billings.length, 'returned');

    const refreshedBillings = await refreshBillingsIfNeeded(billings as any[]);

    // Apply search filter on populated fields (client/patient name)
    const filtered = search
      ? refreshedBillings.filter((b) => {
          const q = (search as string).toLowerCase();
          const owner = b.ownerId as any;
          const pet = b.petId as any;
          return (
            `${owner?.firstName} ${owner?.lastName}`.toLowerCase().includes(q) ||
            pet?.name?.toLowerCase().includes(q)
          );
        })
      : refreshedBillings;

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billings: filtered, total },
    });
  } catch (error) {
    console.error('List billings for clinic error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching billing records' });
  }
};

/**
 * GET /api/billings/my-invoices
 * Pet owner — their own invoices.
 * Query: ?status=&search=
 */
export const listMyInvoices = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status, search } = req.query;

    const query: any = { ownerId: req.user.userId };
    if (status) query.status = status;

    const billings = await Billing.find(query)
      .populate(POPULATE_BILLING)
      .sort({ createdAt: -1 });

    const refreshedBillings = await refreshBillingsIfNeeded(billings as any[]);

    const filtered = search
      ? refreshedBillings.filter((b) => {
          const q = (search as string).toLowerCase();
          const pet = b.petId as any;
          return (
            pet?.name?.toLowerCase().includes(q) ||
            b.serviceLabel?.toLowerCase().includes(q)
          );
        })
      : refreshedBillings;

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billings: filtered },
    });
  } catch (error) {
    console.error('List my invoices error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching invoices' });
  }
};

/**
 * GET /api/billings/vet
 * Veterinarian — their assigned billing records.
 * Query: ?status=&search=
 */
export const listBillingsForVet = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { status, search } = req.query;

    const query: any = { vetId: req.user.userId };
    if (status) query.status = status;

    const billings = await Billing.find(query)
      .populate(POPULATE_BILLING)
      .sort({ createdAt: -1 });

    const refreshedBillings = await refreshBillingsIfNeeded(billings as any[]);

    const filtered = search
      ? refreshedBillings.filter((b) => {
          const q = (search as string).toLowerCase();
          const owner = b.ownerId as any;
          const pet = b.petId as any;
          return (
            `${owner?.firstName} ${owner?.lastName}`.toLowerCase().includes(q) ||
            pet?.name?.toLowerCase().includes(q) ||
            b.serviceLabel?.toLowerCase().includes(q)
          );
        })
      : refreshedBillings;

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billings: filtered },
    });
  } catch (error) {
    console.error('List billings for vet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching billing records' });
  }
};

/**
 * GET /api/billings/medical-record/:medicalRecordId
 * Clinic staff — get the billing record linked to a specific medical record.
 */
export const getBillingByMedicalRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findOne({ medicalRecordId: req.params.medicalRecordId })
      .populate(POPULATE_BILLING);

    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'No billing record found for this medical record' });
    }

    let refreshedBilling = await refreshBillingIfNeeded(billing);
    if (refreshedBilling && !(refreshedBilling as any).invoiceNumber) {
      (refreshedBilling as any).invoiceNumber = await generateNextInvoiceNumber((refreshedBilling as any).clinicId?._id || refreshedBilling.clinicId);
      await (refreshedBilling as any).save();
      refreshedBilling = await Billing.findById(billing._id).populate(POPULATE_BILLING);
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billing: refreshedBilling },
    });
  } catch (error) {
    console.error('Get billing by medical record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the billing record' });
  }
};

/**
 * GET /api/billings/confinement-record/:confinementRecordId
 * Clinic staff — get billing records linked to a specific confinement record.
 */
export const getBillingsByConfinementRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billings = await Billing.find({ confinementRecordId: req.params.confinementRecordId })
      .populate(POPULATE_BILLING)
      .sort({ createdAt: -1 });

    const refreshedBillings = await refreshBillingsIfNeeded(billings as any[]);

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billings: refreshedBillings, total: refreshedBillings.length },
    });
  } catch (error) {
    console.error('Get billings by confinement record error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching billing records' });
  }
};

/**
 * GET /api/billings/:id
 * Any authenticated clinic staff or the record's owner — get a single billing.
 */
export const getBillingById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id).populate(POPULATE_BILLING);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    // Guard: only the owner, the billing's vet, the linked medical record's attending vet, or clinic staff can view
    const isOwner = billing.ownerId.toString() === req.user.userId;
    const billingVetId = (billing.vetId as any)?._id ?? billing.vetId;
    const recordVetId = (billing.medicalRecordId as any)?.vetId;
    const isVet =
      (billingVetId ? billingVetId.toString() === req.user.userId : false) ||
      (recordVetId ? recordVetId.toString() === req.user.userId : false);
    const isClinicStaff =
      req.user.userType === 'clinic-admin';

    if (!isOwner && !isVet && !isClinicStaff) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    let refreshedBilling = await refreshBillingIfNeeded(billing);
    if (refreshedBilling && !(refreshedBilling as any).invoiceNumber) {
      (refreshedBilling as any).invoiceNumber = await generateNextInvoiceNumber((refreshedBilling as any).clinicId?._id || refreshedBilling.clinicId);
      await (refreshedBilling as any).save();
      refreshedBilling = await Billing.findById(billing._id).populate(POPULATE_BILLING);
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billing: refreshedBilling },
    });
  } catch (error) {
    console.error('Get billing by id error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the billing record' });
  }
};

/**
 * PATCH /api/billings/:id
 * Clinic admin: update items, parties, discount, recompute totals.
 * Veterinarian: approve (status: awaiting_approval → pending_payment).
 * Body (admin): { ownerId?, petId?, vetId?, clinicBranchId?, items?, discount?, serviceLabel?, serviceDate? }
 * Body (vet):   { status: 'pending_payment' }
 */
export const updateBilling = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    const isClinicStaff = req.user.userType === 'clinic-admin';

    if (!isClinicStaff) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    // Clinic admin: update any field
    const { ownerId, petId, vetId, clinicBranchId, confinementRecordId, items, discount, serviceLabel, serviceDate, dueDate, birNumber } = req.body;

    // The BIR number is receipt metadata (not a financial detail), so it remains
    // editable even after an invoice is paid/finalized — every other field stays locked.
    const isOnlyBirNumberUpdate = birNumber !== undefined &&
      [ownerId, petId, vetId, clinicBranchId, confinementRecordId, items, discount, serviceLabel, serviceDate, dueDate].every((v) => v === undefined);

    if ((billing.status === 'paid' || billing.isFinalized) && !isOnlyBirNumberUpdate) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Paid invoices are finalized and cannot be modified',
      });
    }

    if (birNumber !== undefined) billing.birNumber = birNumber || null;

    const previousConfinementRecordId = billing.confinementRecordId ? billing.confinementRecordId.toString() : null;

    if (ownerId !== undefined) billing.ownerId = ownerId;
    if (petId !== undefined) billing.petId = petId;
    if (vetId !== undefined) billing.vetId = vetId;
    if (clinicBranchId !== undefined) billing.clinicBranchId = clinicBranchId;
    if (confinementRecordId !== undefined) billing.confinementRecordId = confinementRecordId;
    if (serviceLabel !== undefined) billing.serviceLabel = serviceLabel;
    if (serviceDate !== undefined) billing.serviceDate = serviceDate;
    if (dueDate !== undefined) (billing as any).dueDate = dueDate;

    if (items !== undefined) {
      billing.items = items;
      const discountValue = discount !== undefined ? discount : billing.discount;
      billing.subtotal = computeSubtotal(items);
      billing.discount = discountValue;
      billing.totalAmountDue = Math.max(0, billing.subtotal - billing.discount);
    } else if (discount !== undefined) {
      billing.discount = discount;
      billing.totalAmountDue = Math.max(0, billing.subtotal - discount);
    }

    await billing.save();

    if (confinementRecordId !== undefined) {
      if (previousConfinementRecordId && previousConfinementRecordId !== confinementRecordId) {
        await ConfinementRecord.findByIdAndUpdate(previousConfinementRecordId, {
          $set: { billingId: null },
        });
      }
      if (confinementRecordId) {
        await ConfinementRecord.findByIdAndUpdate(confinementRecordId, {
          $set: { billingId: billing._id },
        });
      }
    }

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Billing record updated successfully',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Update billing error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the billing record' });
  }
};

/**
 * PATCH /api/billings/:id/pay
 * Clinic admin / branch admin — mark a billing as paid.
 */
export const markBillingAsPaid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({ status: 'ERROR', message: 'Billing is already marked as paid' });
    }

    // If linked to a medical record, ensure it is in a payable stage.
    // Standalone billings (e.g. NFC tag) with no medical record are payable at any time.
    if (billing.medicalRecordId) {
      const linkedRecord = await MedicalRecord.findById(billing.medicalRecordId).select('stage').lean();
      const payableStages: string[] = ['completed', 'confined'];
      if (!linkedRecord || !payableStages.includes((linkedRecord as any).stage)) {
        return res.status(400).json({ status: 'ERROR', message: 'Billing can only be marked as paid after the medical record is completed or the pet is admitted' });
      }
    }

    const { amountPaid, paymentMethod } = req.body;

    if (amountPaid !== undefined) {
      const parsedAmount = Number(amountPaid);
      if (Number.isNaN(parsedAmount) || parsedAmount < billing.totalAmountDue) {
        return res.status(400).json({
          status: 'ERROR',
          message: `Amount paid cannot be less than the total amount due (₱${billing.totalAmountDue.toLocaleString()}).`,
        });
      }
    }

    billing.status = 'paid';
    billing.paidAt = new Date();
    billing.isFinalized = true;
    billing.finalizedAt = new Date();
    billing.finalizedBy = req.user.userId as any;
    if (amountPaid !== undefined) (billing as any).amountPaid = amountPaid;
    if (paymentMethod !== undefined) (billing as any).paymentMethod = paymentMethod;
    await billing.save({ validateModifiedOnly: true });

    // Auto-complete grooming appointment when billing is paid
    if (billing.appointmentId) {
      const GROOMING_TYPES = ['basic-grooming', 'full-grooming'];
      const appt = await Appointment.findById(billing.appointmentId);
      if (appt && Array.isArray(appt.types) && appt.types.length > 0 &&
          appt.types.every((t: string) => GROOMING_TYPES.includes(t))) {
        if (appt.status !== 'completed' && appt.status !== 'cancelled') {
          appt.status = 'completed';
          await appt.save();
        }
      }
    }

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING) as any;

    // Send receipt email to owner (fire-and-forget)
    if (populated?.ownerId?.email && populated.petId?.name && populated.vetId) {
      sendBillingPaidReceipt({
        ownerEmail: populated.ownerId.email,
        ownerFirstName: populated.ownerId.firstName,
        petName: populated.petId.name,
        vetName: `${populated.vetId.firstName} ${populated.vetId.lastName}`,
        items: populated.items,
        subtotal: populated.subtotal,
        discount: populated.discount,
        totalAmountDue: populated.totalAmountDue,
        serviceDate: populated.serviceDate,
        paidAt: populated.paidAt,
      });
    }

    if (populated?.ownerId?._id && populated.petId?.name) {
      await createNotification(
        populated.ownerId._id.toString(),
        'bill_paid',
        'Payment Confirmed',
        `Your payment of ₱${populated.totalAmountDue.toFixed(2)} for ${populated.petId.name} has been received. Thank you!`,
        { billingId: billing._id }
      );
    }

    if (populated?.clinicId?._id && populated?.petId?.name && populated?.ownerId) {
      const paidDate = populated.paidAt
        ? new Date(populated.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      await alertClinicAdmins({
        clinicId: populated.clinicId._id,
        clinicBranchId: populated.clinicBranchId?._id || null,
        notificationType: 'clinic_invoice_paid',
        notificationTitle: 'Invoice Paid by Pet Owner',
        notificationMessage: `${populated.ownerId.firstName} ${populated.ownerId.lastName} paid ₱${populated.totalAmountDue.toFixed(2)} for ${populated.petId.name}.`,
        metadata: {
          billingId: populated._id,
          ownerId: populated.ownerId._id,
          petId: populated.petId._id,
          clinicId: populated.clinicId._id,
          clinicBranchId: populated.clinicBranchId?._id || null,
          amountPaid: populated.totalAmountDue,
          paidAt: populated.paidAt,
          paymentMethod: (populated as any).paymentMethod,
        },
        emailSubject: `PawSync – Invoice Paid (${populated.petId.name})`,
        emailHeadline: 'Pet Owner Payment Received',
        emailIntro: 'A pet owner payment has been recorded for a clinic invoice.',
        emailDetails: {
          Pet: populated.petId.name,
          Owner: `${populated.ownerId.firstName} ${populated.ownerId.lastName}`,
          'Amount Paid': `₱${populated.totalAmountDue.toFixed(2)}`,
          'Paid On': paidDate,
          Branch: populated.clinicBranchId?.name || 'Clinic Branch',
          'Payment Method': (populated as any).paymentMethod || 'Not specified',
        },
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Billing marked as paid',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Mark billing as paid error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the billing record' });
  }
};

/**
 * POST /api/billings/:id/submit-qr-proof
 * Pet owner — submit a QR payment screenshot for clinic review.
 * Body: { screenshot: string (data URL or uploads path) }
 */
export const submitQrPaymentProof = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    if (billing.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    if (billing.status !== 'pending_payment') {
      return res.status(400).json({ status: 'ERROR', message: 'This billing is not awaiting payment' });
    }

    const { screenshot } = req.body;
    if (!screenshot) {
      return res.status(400).json({ status: 'ERROR', message: 'Payment screenshot is required' });
    }
    const isDataUrl = typeof screenshot === 'string' && screenshot.startsWith('data:image/');
    const isLocalUploadsPath = typeof screenshot === 'string' && screenshot.startsWith('/uploads/');
    const isLegacyAbsoluteUploadsUrl = typeof screenshot === 'string' && /^https?:\/\/[^\s]+\/uploads\//i.test(screenshot);
    if (!isDataUrl && !isLocalUploadsPath && !isLegacyAbsoluteUploadsUrl) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid image format' });
    }

    billing.qrPaymentProof = screenshot;
    billing.qrPaymentSubmittedAt = new Date();
    billing.pendingQrApproval = true;
    await billing.save();

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING) as any;

    if (populated?.clinicId?._id && populated?.petId?.name && populated?.ownerId) {
      const submittedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      await alertClinicAdmins({
        clinicId: populated.clinicId._id,
        clinicBranchId: populated.clinicBranchId?._id || null,
        notificationType: 'clinic_qr_payment_submitted',
        notificationTitle: 'QR Payment Proof Submitted',
        notificationMessage: `${populated.ownerId.firstName} ${populated.ownerId.lastName} submitted a QR payment screenshot for ${populated.petId.name}. Please review and approve.`,
        metadata: { billingId: billing._id },
        emailSubject: `PawSync – QR Payment Submitted (${populated.petId.name})`,
        emailHeadline: 'QR Payment Proof Submitted',
        emailIntro: 'A pet owner has submitted a QR payment screenshot for your review.',
        emailDetails: {
          Pet: populated.petId.name,
          Owner: `${populated.ownerId.firstName} ${populated.ownerId.lastName}`,
          'Amount Due': `₱${populated.totalAmountDue.toFixed(2)}`,
          'Submitted On': submittedDate,
          Branch: populated.clinicBranchId?.name || 'Clinic Branch',
        },
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Payment proof submitted successfully. Awaiting clinic approval.',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Submit QR payment proof error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while submitting payment proof' });
  }
};

/**
 * POST /api/billings/:id/approve-qr-payment
 * Clinic admin — approve a pet owner's QR payment and mark billing as paid.
 */
export const approveQrPayment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    if (!billing.pendingQrApproval) {
      return res.status(400).json({ status: 'ERROR', message: 'No pending QR payment to approve' });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({ status: 'ERROR', message: 'Billing is already marked as paid' });
    }

    billing.status = 'paid';
    billing.paidAt = new Date();
    billing.paymentMethod = 'qr';
    billing.isFinalized = true;
    billing.finalizedAt = new Date();
    billing.finalizedBy = req.user.userId as any;
    (billing as any).amountPaid = billing.totalAmountDue;
    billing.pendingQrApproval = false;
    await billing.save({ validateModifiedOnly: true });

    // Auto-complete grooming appointment when billing is paid via QR
    if (billing.appointmentId) {
      const GROOMING_TYPES = ['basic-grooming', 'full-grooming'];
      const appt = await Appointment.findById(billing.appointmentId);
      if (appt && Array.isArray(appt.types) && appt.types.length > 0 &&
          appt.types.every((t: string) => GROOMING_TYPES.includes(t))) {
        if (appt.status !== 'completed' && appt.status !== 'cancelled') {
          appt.status = 'completed';
          await appt.save();
        }
      }
    }

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING) as any;

    if (populated?.ownerId?.email && populated.petId?.name && populated.vetId) {
      sendBillingPaidReceipt({
        ownerEmail: populated.ownerId.email,
        ownerFirstName: populated.ownerId.firstName,
        petName: populated.petId.name,
        vetName: `${populated.vetId.firstName} ${populated.vetId.lastName}`,
        items: populated.items,
        subtotal: populated.subtotal,
        discount: populated.discount,
        totalAmountDue: populated.totalAmountDue,
        serviceDate: populated.serviceDate,
        paidAt: populated.paidAt,
      });
    }

    if (populated?.ownerId?._id && populated.petId?.name) {
      await createNotification(
        populated.ownerId._id.toString(),
        'bill_paid',
        'QR Payment Approved',
        `Your QR payment of ₱${populated.totalAmountDue.toFixed(2)} for ${populated.petId.name} has been approved. Thank you!`,
        { billingId: billing._id }
      );
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'QR payment approved and billing marked as paid',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Approve QR payment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while approving the payment' });
  }
};

/**
 * POST /api/billings/:id/reject-qr-payment
 * Clinic admin — reject a pet owner's QR payment submission and reset so they can re-submit.
 */
export const rejectQrPayment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    if (!billing.pendingQrApproval) {
      return res.status(400).json({ status: 'ERROR', message: 'No pending QR payment to reject' });
    }

    billing.pendingQrApproval = false;
    billing.qrPaymentProof = null;
    billing.qrPaymentSubmittedAt = null;
    await billing.save();

    const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING) as any;

    if (populated?.ownerId?._id && populated.petId?.name) {
      await createNotification(
        populated.ownerId._id.toString(),
        'bill_paid',
        'QR Payment Rejected',
        `Your QR payment submission for ${populated.petId.name} was rejected. Please submit a new payment screenshot.`,
        { billingId: billing._id }
      );
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'QR payment rejected. Pet owner can re-submit.',
      data: { billing: populated },
    });
  } catch (error) {
    console.error('Reject QR payment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while rejecting the payment' });
  }
};

/**
 * DELETE /api/billings
 * Clinic admin / branch admin — bulk delete billing records by IDs.
 * Body: { ids: string[] }
 */
export const deleteBillings = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'ids array is required' });
    }

    const clinicId = req.user.clinicId;

    // Only delete billings that belong to this clinic
    const result = await Billing.deleteMany({ _id: { $in: ids }, clinicId });

    return res.status(200).json({
      status: 'SUCCESS',
      message: `${result.deletedCount} billing record(s) deleted`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error('Delete billings error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting billing records' });
  }
};

/**
 * GET /api/billings/:id/download-pdf
 * Download legal-ready receipt PDF in A4 (default) or thermal widths.
 * Query: ?layout=a4|thermal-58|thermal-80
 */
export const downloadBillingPdf = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const billing = await Billing.findById(req.params.id).populate([
      { path: 'ownerId', select: 'firstName lastName email' },
      { path: 'petId', select: 'name species breed' },
      { path: 'vetId', select: 'firstName lastName' },
      {
        path: 'clinicId',
        select: 'name legalBusinessName address phone email businessTaxId businessRegistrationNo receiptFooterNote logo',
      },
      { path: 'clinicBranchId', select: 'name address city province phone email' },
    ]) as any;

    if (!billing) {
      return res.status(404).json({ status: 'ERROR', message: 'Billing record not found' });
    }

    const isOwner = billing.ownerId?._id?.toString() === req.user.userId;
    const isVet = billing.vetId?._id ? billing.vetId._id.toString() === req.user.userId : false;
    const isClinicStaff = req.user.userType === 'clinic-admin';
    if (!isOwner && !isVet && !isClinicStaff) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    // Backward compatibility for historical rows created before invoice numbering rollout.
    if (!billing.invoiceNumber) {
      billing.invoiceNumber = await generateNextInvoiceNumber(billing.clinicId._id || billing.clinicId);
      await billing.save();
    }

    const requestedLayout = req.query.layout;
    const layout: ReceiptLayout = isReceiptLayout(requestedLayout) ? requestedLayout : 'a4';

    const pdfBuffer = await generateBillingReceiptPdf(billing, { layout });

    const petName = sanitizeFileNamePart(billing.petId?.name || 'pet');
    const issued = new Date(billing.issueDateTime || billing.createdAt || new Date())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const filename = `receipt-${billing.invoiceNumber}-${petName}-${issued}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Download billing PDF error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while generating the receipt PDF' });
  }
};
