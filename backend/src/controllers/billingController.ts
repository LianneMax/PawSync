import { Request, Response } from 'express';
import Billing from '../models/Billing';
import User from '../models/User';
import Clinic from '../models/Clinic';
import MedicalRecord from '../models/MedicalRecord';
import { sendBillingPendingPayment, sendBillingPaidReceipt } from '../services/emailService';
import { createNotification } from '../services/notificationService';

// Populate fields shared across all views
const POPULATE_BILLING = [
  { path: 'ownerId', select: 'firstName lastName email' },
  { path: 'petId', select: 'name species breed' },
  { path: 'vetId', select: 'firstName lastName' },
  { path: 'clinicId', select: 'name' },
  { path: 'clinicBranchId', select: 'name' },
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
      appointmentId,
      items = [],
      discount = 0,
      serviceLabel,
      serviceDate,
    } = req.body;

    if (!ownerId || !petId || !vetId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId, petId, and vetId are required' });
    }

    let clinicId = req.user.clinicId;

    // Fall back 1: DB lookup for the admin user
    if (!clinicId) {
      const dbUser = await User.findById(req.user.userId).select('clinicId').lean();
      clinicId = (dbUser as any)?.clinicId?.toString();
    }

    // Fall back 2: derive from the linked medical record (most reliable when admin has record access)
    if (!clinicId && medicalRecordId) {
      const linkedRecord = await MedicalRecord.findById(medicalRecordId).select('clinicId').lean();
      clinicId = (linkedRecord as any)?.clinicId?.toString();
    }

    // Fall back 3: legacy clinic-admin linked via Clinic.adminId
    if (!clinicId) {
      const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true }).select('_id').lean();
      clinicId = (clinic as any)?._id?.toString();
    }

    if (!clinicId) {
      return res.status(400).json({ status: 'ERROR', message: 'Clinic information is missing from your account' });
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice || 0), 0);
    const totalAmountDue = Math.max(0, subtotal - discount);

    // Auto-generate serviceLabel from item names if not provided
    const resolvedLabel = serviceLabel ||
      (items.length > 0 ? items.map((i: any) => i.name).join(', ') : '');

    const billing = await Billing.create({
      ownerId,
      petId,
      vetId,
      clinicId,
      clinicBranchId: clinicBranchId || req.user.clinicBranchId || null,
      medicalRecordId: medicalRecordId || null,
      appointmentId: appointmentId || null,
      items,
      subtotal,
      discount,
      totalAmountDue,
      serviceLabel: resolvedLabel,
      serviceDate: serviceDate || new Date(),
    });

    // Link billing back to the medical record so the page knows one already exists
    if (medicalRecordId) {
      await MedicalRecord.findByIdAndUpdate(medicalRecordId, { billingId: billing._id });
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
    // Legacy fallback: clinic-admin may be linked via Clinic.adminId instead of User.clinicId
    if (!clinicId) {
      const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true }).select('_id').lean();
      clinicId = (clinic as any)?._id?.toString();
      console.log('[listBillingsForClinic] clinicId from Clinic.adminId lookup:', clinicId);
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
    const isVet = billing.vetId.toString() === req.user.userId;
    const isClinicStaff =
      req.user.userType === 'clinic-admin' || req.user.userType === 'branch-admin';

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

    const isClinicStaff =
      req.user.userType === 'clinic-admin' || req.user.userType === 'branch-admin';
    const isVet = req.user.userType === 'veterinarian';

    if (!isClinicStaff && !isVet) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    // Vet can only approve (awaiting_approval → pending_payment)
    if (isVet) {
      if (billing.vetId.toString() !== req.user.userId) {
        return res.status(403).json({ status: 'ERROR', message: 'You are not the assigned veterinarian for this billing' });
      }
      if (billing.status !== 'awaiting_approval') {
        return res.status(400).json({ status: 'ERROR', message: 'Only billings awaiting approval can be approved' });
      }
      billing.status = 'pending_payment';
      await billing.save();
      const populated = await Billing.findById(billing._id).populate(POPULATE_BILLING) as any;

      // Send payment-due email to owner (fire-and-forget)
      if (populated?.ownerId?.email && populated.petId?.name && populated.vetId) {
        sendBillingPendingPayment({
          ownerEmail: populated.ownerId.email,
          ownerFirstName: populated.ownerId.firstName,
          petName: populated.petId.name,
          vetName: `${populated.vetId.firstName} ${populated.vetId.lastName}`,
          items: populated.items,
          subtotal: populated.subtotal,
          discount: populated.discount,
          totalAmountDue: populated.totalAmountDue,
          serviceDate: populated.serviceDate,
        });
        await createNotification(
          populated.ownerId._id.toString(),
          'bill_due',
          'New Invoice Ready',
          `A new invoice of ₱${populated.totalAmountDue.toFixed(2)} for ${populated.petId.name} is ready for payment.`,
          { billingId: billing._id }
        );
      }

      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Billing approved',
        data: { billing: populated },
      });
    }

    // Clinic admin: update any field
    const { ownerId, petId, vetId, clinicBranchId, items, discount, serviceLabel, serviceDate } = req.body;

    if (ownerId !== undefined) billing.ownerId = ownerId;
    if (petId !== undefined) billing.petId = petId;
    if (vetId !== undefined) billing.vetId = vetId;
    if (clinicBranchId !== undefined) billing.clinicBranchId = clinicBranchId;
    if (serviceLabel !== undefined) billing.serviceLabel = serviceLabel;
    if (serviceDate !== undefined) billing.serviceDate = serviceDate;

    if (items !== undefined) {
      billing.items = items;
      const discountValue = discount !== undefined ? discount : billing.discount;
      billing.subtotal = items.reduce((sum: number, item: any) => sum + (item.unitPrice || 0), 0);
      billing.discount = discountValue;
      billing.totalAmountDue = Math.max(0, billing.subtotal - billing.discount);
    } else if (discount !== undefined) {
      billing.discount = discount;
      billing.totalAmountDue = Math.max(0, billing.subtotal - discount);
    }

    await billing.save();
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

    billing.status = 'paid';
    billing.paidAt = new Date();
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
