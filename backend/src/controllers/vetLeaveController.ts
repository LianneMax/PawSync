import { Request, Response } from 'express';
import mongoose from 'mongoose';
import VetLeave from '../models/VetLeave';
import Appointment from '../models/Appointment';
import User from '../models/User';
import Pet from '../models/Pet';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import { createNotification } from '../services/notificationService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import { sendVetLeaveCancellation, sendAppointmentReassigned } from '../services/emailService';

const MIN_ADVANCE_DAYS = 3;

function toDateUTC(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

function getTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validateLeaveDate(date: string): string | null {
  const todayYmd = getTodayYmd();
  if (date <= todayYmd) return 'Leave date must be in the future';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = date.split('-').map(Number);
  const leaveDate = new Date(y, m - 1, d);
  const diffDays = Math.ceil((leaveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < MIN_ADVANCE_DAYS) {
    return `Leave must be filed at least ${MIN_ADVANCE_DAYS} days in advance`;
  }
  return null;
}

/**
 * POST /api/vet-leave/preview
 * Returns conflict information for a proposed leave date without saving anything.
 */
export const previewLeave = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const { date } = req.body;
    if (!date) return res.status(400).json({ status: 'ERROR', message: 'date is required' });

    const validationError = validateLeaveDate(date as string);
    if (validationError) return res.status(400).json({ status: 'ERROR', message: validationError });

    const { start, end } = toDateUTC(date as string);

    const existing = await VetLeave.findOne({
      vetId: req.user.userId,
      date: { $gte: start, $lte: end },
      status: 'active',
    });
    if (existing) return res.status(409).json({ status: 'ERROR', message: 'You already have leave filed for this date' });

    // Find affected appointments for this vet on that date
    const affected = await Appointment.find({
      vetId: req.user.userId,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed', 'rescheduled'] },
    })
      .populate('petId', 'name')
      .populate('ownerId', 'firstName lastName')
      .populate('clinicBranchId', 'name _id');

    if (affected.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', data: { affectedAppointments: [] } });
    }

    // For each affected appointment, find other vets available at the same branch + time slot
    const results = await Promise.all(
      affected.map(async (appt) => {
        const branchId = (appt.clinicBranchId as any)?._id ?? appt.clinicBranchId;
        const clinicId = appt.clinicId;

        const otherAssignments = await AssignedVet.find({
          clinicBranchId: branchId,
          clinicId,
          isActive: true,
          vetId: { $ne: new mongoose.Types.ObjectId(req.user!.userId) },
          petId: null,
        }).populate('vetId', 'firstName lastName');

        const availableVets: { _id: string; firstName: string; lastName: string }[] = [];
        for (const assignment of otherAssignments) {
          const otherVet = assignment.vetId as any;
          if (!otherVet) continue;
          const conflict = await Appointment.findOne({
            vetId: otherVet._id,
            date: { $gte: start, $lte: end },
            startTime: appt.startTime,
            status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] },
          });
          if (!conflict) {
            availableVets.push({
              _id: otherVet._id.toString(),
              firstName: otherVet.firstName,
              lastName: otherVet.lastName,
            });
          }
        }

        return {
          appointmentId: (appt as any)._id.toString(),
          petName: (appt.petId as any)?.name || 'Pet',
          ownerName: `${(appt.ownerId as any)?.firstName || ''} ${(appt.ownerId as any)?.lastName || ''}`.trim(),
          startTime: appt.startTime,
          endTime: appt.endTime,
          types: appt.types,
          branchName: (appt.clinicBranchId as any)?.name || '',
          availableVets,
        };
      })
    );

    return res.status(200).json({ status: 'SUCCESS', data: { affectedAppointments: results } });
  } catch (err) {
    console.error('[VetLeave] previewLeave error:', err);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/vet-leave
 * File a leave. Body: { date, reason?, decisions: [{ appointmentId, action: 'reassign'|'cancel', newVetId? }] }
 * The leave record is created first; decisions are processed fire-and-forget so email failures
 * never roll back the cancellation.
 */
export const applyLeave = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const { date, reason, decisions = [] } = req.body;
    if (!date) return res.status(400).json({ status: 'ERROR', message: 'date is required' });

    const validationError = validateLeaveDate(date as string);
    if (validationError) return res.status(400).json({ status: 'ERROR', message: validationError });

    const { start, end } = toDateUTC(date as string);

    const existing = await VetLeave.findOne({
      vetId: req.user.userId,
      date: { $gte: start, $lte: end },
      status: 'active',
    });
    if (existing) return res.status(409).json({ status: 'ERROR', message: 'You already have leave filed for this date' });

    // Create the leave record first — decisions are handled afterwards
    const leave = await VetLeave.create({
      vetId: req.user.userId,
      date: start,
      reason: reason || null,
      status: 'active',
    });

    // Process appointment decisions (fire-and-forget — failures do NOT roll back the leave)
    if (Array.isArray(decisions) && decisions.length > 0) {
      processLeaveDecisions(req.user.userId, decisions).catch((err) => {
        console.error('[VetLeave] processLeaveDecisions error (non-fatal):', err);
      });
    }

    return res.status(201).json({ status: 'SUCCESS', message: 'Leave filed successfully', data: { leave } });
  } catch (err) {
    console.error('[VetLeave] applyLeave error:', err);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

async function processLeaveDecisions(
  vetUserId: string,
  decisions: { appointmentId: string; action: 'reassign' | 'cancel'; newVetId?: string }[]
) {
  const vet = await User.findById(vetUserId).select('firstName lastName');

  for (const decision of decisions) {
    try {
      const appt = await Appointment.findById(decision.appointmentId);
      if (!appt || appt.status === 'cancelled' || appt.status === 'completed') continue;

      if (decision.action === 'reassign' && decision.newVetId) {
        appt.vetId = new mongoose.Types.ObjectId(decision.newVetId);
        await appt.save();

        const [owner, pet, newVet, branch] = await Promise.all([
          User.findById(appt.ownerId).select('firstName email'),
          Pet.findById(appt.petId).select('name'),
          User.findById(decision.newVetId).select('firstName lastName'),
          ClinicBranch.findById(appt.clinicBranchId).select('name'),
        ]);

        if (owner) {
          const dateLabel = new Date(appt.date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const newVetName = `${(newVet as any)?.firstName || ''} ${(newVet as any)?.lastName || ''}`.trim();
          const petName = (pet as any)?.name || 'your pet';

          await createNotification(
            appt.ownerId.toString(),
            'appointment_reassigned',
            'Appointment Reassigned',
            `Your appointment for ${petName} on ${dateLabel} has been reassigned to Dr. ${newVetName}.`,
            { appointmentId: appt._id }
          );

          // Email owner about reassignment — failure is logged but does NOT undo the reassignment
          try {
            await sendAppointmentReassigned({
              ownerEmail: (owner as any).email,
              ownerFirstName: (owner as any).firstName,
              petName,
              previousVetName: `${vet?.firstName || ''} ${vet?.lastName || ''}`.trim(),
              newVetName,
              clinicName: (branch as any)?.name || 'your clinic',
              date: appt.date,
              startTime: appt.startTime,
              types: appt.types,
            });
          } catch (emailErr) {
            console.error('[VetLeave] sendAppointmentReassigned email failed (non-fatal):', emailErr);
          }
        }
      } else {
        // Cancel the appointment — leave record already exists; only set status
        appt.status = 'cancelled';
        await appt.save();

        const [owner, pet, branch] = await Promise.all([
          User.findById(appt.ownerId).select('firstName email'),
          Pet.findById(appt.petId).select('name'),
          ClinicBranch.findById(appt.clinicBranchId).select('name'),
        ]);

        const petName = (pet as any)?.name || 'your pet';
        const dateLabel = new Date(appt.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        if (owner) {
          // In-app notification to owner
          await createNotification(
            appt.ownerId.toString(),
            'appointment_cancelled',
            'Appointment Cancelled – Vet on Leave',
            `Your appointment for ${petName} on ${dateLabel} has been cancelled because Dr. ${vet?.firstName} ${vet?.lastName} is on approved leave.`,
            { appointmentId: appt._id }
          );

          // Email to owner — failure is logged but does NOT undo cancellation
          try {
            await sendVetLeaveCancellation({
              ownerEmail: (owner as any).email,
              ownerFirstName: (owner as any).firstName,
              petName,
              vetName: `${vet?.firstName || ''} ${vet?.lastName || ''}`,
              date: appt.date,
              startTime: appt.startTime,
            });
          } catch (emailErr) {
            console.error('[VetLeave] sendVetLeaveCancellation email failed (non-fatal):', emailErr);
          }
        }

        // Notify clinic admins — failure is logged but does NOT undo cancellation
        try {
          await alertClinicAdmins({
            clinicId: appt.clinicId,
            clinicBranchId: appt.clinicBranchId,
            notificationType: 'clinic_appointment_cancelled',
            notificationTitle: 'Appointment Cancelled – Vet on Leave',
            notificationMessage: `Appointment for ${petName} on ${dateLabel} at ${appt.startTime} was cancelled because Dr. ${vet?.firstName} ${vet?.lastName} is on approved leave.`,
            metadata: { appointmentId: appt._id, vetId: vetUserId },
            emailSubject: `PawSync – Appointment Cancelled (Vet on Leave)`,
            emailHeadline: 'Appointment Cancelled Due to Vet Leave',
            emailIntro: 'An appointment was auto-cancelled because the assigned vet is on approved leave.',
            emailDetails: {
              Pet: petName,
              Date: dateLabel,
              Time: appt.startTime,
              Branch: (branch as any)?.name || 'Clinic Branch',
              Reason: `Dr. ${vet?.firstName} ${vet?.lastName} is on approved leave`,
            },
          });
        } catch (alertErr) {
          console.error('[VetLeave] alertClinicAdmins failed (non-fatal):', alertErr);
        }
      }
    } catch (apptErr) {
      console.error(`[VetLeave] processDecision failed for appointment ${decision.appointmentId} (non-fatal):`, apptErr);
    }
  }
}

/**
 * GET /api/vet-leave/mine
 * Returns the authenticated vet's active upcoming leaves with affected appointment counts.
 */
export const getMyLeaves = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaves = await VetLeave.find({
      vetId: req.user.userId,
      status: 'active',
      date: { $gte: today },
    }).sort({ date: 1 });

    const leavesWithCounts = await Promise.all(
      leaves.map(async (leave) => {
        const leaveDateStart = new Date(leave.date);
        leaveDateStart.setUTCHours(0, 0, 0, 0);
        const leaveDateEnd = new Date(leave.date);
        leaveDateEnd.setUTCHours(23, 59, 59, 999);

        const count = await Appointment.countDocuments({
          vetId: req.user!.userId,
          date: { $gte: leaveDateStart, $lte: leaveDateEnd },
          status: { $in: ['pending', 'confirmed', 'rescheduled'] },
        });

        return {
          _id: (leave as any)._id,
          date: leave.date,
          reason: leave.reason,
          status: leave.status,
          affectedAppointmentCount: count,
        };
      })
    );

    return res.status(200).json({ status: 'SUCCESS', data: { leaves: leavesWithCounts } });
  } catch (err) {
    console.error('[VetLeave] getMyLeaves error:', err);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * DELETE /api/vet-leave/:id
 * Cancel a filed leave (only future leaves can be cancelled).
 */
export const cancelLeave = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const leave = await VetLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ status: 'ERROR', message: 'Leave not found' });
    if (leave.vetId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized' });
    }
    if (leave.status === 'cancelled') {
      return res.status(400).json({ status: 'ERROR', message: 'Leave is already cancelled' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leaveDate = new Date(leave.date);
    leaveDate.setUTCHours(0, 0, 0, 0);
    if (leaveDate <= today) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot cancel a leave that has already started or passed' });
    }

    leave.status = 'cancelled';
    await leave.save();

    return res.status(200).json({ status: 'SUCCESS', message: 'Leave cancelled successfully' });
  } catch (err) {
    console.error('[VetLeave] cancelLeave error:', err);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
