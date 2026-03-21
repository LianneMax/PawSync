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

function formatAppointmentTypesForServiceLabel(types: string[] = []): string {
  if (!Array.isArray(types) || types.length === 0) return '';

  return types
    .map((type) =>
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
  { path: 'vetId', select: 'firstName lastName' },
  { path: 'clinicId', select: 'name' },
  { path: 'clinicBranchId', select: 'name' },
  { path: 'medicalRecordId', select: 'stage' },
  { path: 'confinementRecordId', select: 'status admissionDate dischargeDate' },
];

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
    } = req.body;

    if (!ownerId || !petId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId and petId are required' });
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

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0);
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

    const billing = await Billing.create({
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

    // Apply search filter on populated fields (client/patient name)
    const filtered = search
      ? billings.filter((b) => {
          const q = (search as string).toLowerCase();
          const owner = b.ownerId as any;
          const pet = b.petId as any;
          return (
            `${owner?.firstName} ${owner?.lastName}`.toLowerCase().includes(q) ||
            pet?.name?.toLowerCase().includes(q)
          );
        })
      : billings;

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

    const filtered = search
      ? billings.filter((b) => {
          const q = (search as string).toLowerCase();
          const pet = b.petId as any;
          return (
            pet?.name?.toLowerCase().includes(q) ||
            b.serviceLabel?.toLowerCase().includes(q)
          );
        })
      : billings;

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

    const filtered = search
      ? billings.filter((b) => {
          const q = (search as string).toLowerCase();
          const owner = b.ownerId as any;
          const pet = b.petId as any;
          return (
            `${owner?.firstName} ${owner?.lastName}`.toLowerCase().includes(q) ||
            pet?.name?.toLowerCase().includes(q) ||
            b.serviceLabel?.toLowerCase().includes(q)
          );
        })
      : billings;

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

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billing },
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

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billings, total: billings.length },
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

    // Guard: only the owner, the vet, or clinic staff can view
    const isOwner = billing.ownerId.toString() === req.user.userId;
    const isVet = billing.vetId ? billing.vetId.toString() === req.user.userId : false;
    const isClinicStaff =
      req.user.userType === 'clinic-admin';

    if (!isOwner && !isVet && !isClinicStaff) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { billing },
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
    const { ownerId, petId, vetId, clinicBranchId, confinementRecordId, items, discount, serviceLabel, serviceDate } = req.body;

    const previousConfinementRecordId = billing.confinementRecordId ? billing.confinementRecordId.toString() : null;

    if (ownerId !== undefined) billing.ownerId = ownerId;
    if (petId !== undefined) billing.petId = petId;
    if (vetId !== undefined) billing.vetId = vetId;
    if (clinicBranchId !== undefined) billing.clinicBranchId = clinicBranchId;
    if (confinementRecordId !== undefined) billing.confinementRecordId = confinementRecordId;
    if (serviceLabel !== undefined) billing.serviceLabel = serviceLabel;
    if (serviceDate !== undefined) billing.serviceDate = serviceDate;

    if (items !== undefined) {
      billing.items = items;
      const discountValue = discount !== undefined ? discount : billing.discount;
      billing.subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0);
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

    billing.status = 'paid';
    billing.paidAt = new Date();
    if (amountPaid !== undefined) (billing as any).amountPaid = amountPaid;
    if (paymentMethod !== undefined) (billing as any).paymentMethod = paymentMethod;
    await billing.save();

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
 * Body: { screenshot: string (data URL) }
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
    if (!screenshot.startsWith('data:image/')) {
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
    (billing as any).amountPaid = billing.totalAmountDue;
    billing.pendingQrApproval = false;
    await billing.save();

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
