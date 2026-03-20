import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Resignation from '../models/Resignation';
import User from '../models/User';
import AssignedVet from '../models/AssignedVet';
import ClinicBranch from '../models/ClinicBranch';
import Appointment from '../models/Appointment';
import VetSchedule from '../models/VetSchedule';
import Pet from '../models/Pet';
import MedicalRecord from '../models/MedicalRecord';
import Vaccination from '../models/Vaccination';
import AuditTrail from '../models/AuditTrail';
import { createNotification } from '../services/notificationService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import { getClinicForAdmin } from './clinicController';

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress'];
const RESCHEDULABLE_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function generateTimeSlots(
  startTime = '07:00',
  endTime = '17:00',
  breakStart?: string | null,
  breakEnd?: string | null
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  let [h, m] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  while (h < endH || (h === endH && m < endM)) {
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    let nextH = h;
    let nextM = m + 30;
    if (nextM >= 60) {
      nextH++;
      nextM -= 60;
    }
    const nextHStr = nextH.toString().padStart(2, '0');
    const nextMStr = nextM.toString().padStart(2, '0');
    const slotStart = `${hStr}:${mStr}`;
    const slotEnd = `${nextHStr}:${nextMStr}`;

    const overlapsBreak = breakStart && breakEnd && slotStart < breakEnd && slotEnd > breakStart;
    if (!overlapsBreak) {
      slots.push({ startTime: slotStart, endTime: slotEnd });
    }

    h = nextH;
    m = nextM;
  }

  return slots;
}

async function writeAudit(params: {
  action: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  clinicId?: string | mongoose.Types.ObjectId | null;
  clinicBranchId?: string | mongoose.Types.ObjectId | null;
  metadata?: Record<string, any>;
}) {
  await AuditTrail.create({
    action: params.action,
    actorUserId: params.actorUserId || null,
    targetUserId: params.targetUserId || null,
    clinicId: params.clinicId || null,
    clinicBranchId: params.clinicBranchId || null,
    metadata: params.metadata || {},
  });
}

async function getVetClinicContext(vetId: string) {
  const assignment = await AssignedVet.findOne({
    vetId,
    isActive: true,
    petId: null,
    clinicId: { $ne: null },
    clinicBranchId: { $ne: null },
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (assignment?.clinicId && assignment?.clinicBranchId) {
    return {
      clinicId: assignment.clinicId.toString(),
      clinicBranchId: assignment.clinicBranchId.toString(),
    };
  }

  const user = await User.findById(vetId).select('clinicId clinicBranchId');
  if (user?.clinicId && user?.clinicBranchId) {
    return {
      clinicId: user.clinicId.toString(),
      clinicBranchId: user.clinicBranchId.toString(),
    };
  }

  return null;
}

async function findNextAvailableSlot(params: {
  backupVetId: string;
  clinicBranchId: string;
  date: Date;
  originalStartTime: string;
  excludedAppointmentId: string;
}): Promise<{ date: Date; startTime: string; endTime: string } | null> {
  const branch = await ClinicBranch.findById(params.clinicBranchId).select('openingTime closingTime operatingDays');
  const vetSchedule = await VetSchedule.findOne({
    vetId: params.backupVetId,
    branchId: params.clinicBranchId,
  });

  const startDate = new Date(params.date);
  startDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 7; offset++) {
    const candidateDate = new Date(startDate);
    candidateDate.setDate(startDate.getDate() + offset);

    const dayName = DAY_NAMES[candidateDate.getDay()];
    let slotStart = '07:00';
    let slotEnd = '17:00';
    let breakStart: string | null = null;
    let breakEnd: string | null = null;

    if (vetSchedule) {
      if (!vetSchedule.workingDays.includes(dayName)) continue;
      slotStart = vetSchedule.startTime;
      slotEnd = vetSchedule.endTime;
      breakStart = vetSchedule.breakStart ?? null;
      breakEnd = vetSchedule.breakEnd ?? null;
    } else if (branch) {
      if (Array.isArray(branch.operatingDays) && branch.operatingDays.length > 0 && !branch.operatingDays.includes(dayName)) continue;
      if (branch.openingTime) slotStart = branch.openingTime;
      if (branch.closingTime) slotEnd = branch.closingTime;
    }

    const allSlots = generateTimeSlots(slotStart, slotEnd, breakStart, breakEnd);
    const orderedSlots = offset === 0
      ? [...allSlots.filter((s) => s.startTime >= params.originalStartTime), ...allSlots.filter((s) => s.startTime < params.originalStartTime)]
      : allSlots;

    for (const slot of orderedSlots) {
      const conflict = await Appointment.findOne({
        _id: { $ne: params.excludedAppointmentId },
        vetId: params.backupVetId,
        date: candidateDate,
        startTime: slot.startTime,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }).select('_id isEmergency');

      if (!conflict) {
        return { date: candidateDate, startTime: slot.startTime, endTime: slot.endTime };
      }
    }
  }

  return null;
}

export const getMyResignation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    if (req.user.userType !== 'veterinarian') {
      return res.status(403).json({ status: 'ERROR', message: 'Only veterinarians can access resignation details' });
    }

    const latest = await Resignation.findOne({ vetId: req.user.userId })
      .populate('backupVetId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const user = await User.findById(req.user.userId).select('resignation');

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        resignation: latest,
        profileResignation: user?.resignation || null,
      },
    });
  } catch (error) {
    console.error('Get my resignation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while loading resignation details' });
  }
};

export const getBackupVetsForMyBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    if (req.user.userType !== 'veterinarian') {
      return res.status(403).json({ status: 'ERROR', message: 'Only veterinarians can access backup vet options' });
    }

    const context = await getVetClinicContext(req.user.userId);
    if (!context) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic assignment not found' });
    }

    const assignments = await AssignedVet.find({
      clinicId: context.clinicId,
      clinicBranchId: context.clinicBranchId,
      isActive: true,
      petId: null,
      vetId: { $ne: req.user.userId },
    }).populate('vetId', 'firstName lastName email userType resignation');

    const vets = assignments
      .map((assignment) => assignment.vetId as any)
      .filter((vet) => vet && vet.userType === 'veterinarian')
      .map((vet) => ({
        _id: vet._id,
        firstName: vet.firstName,
        lastName: vet.lastName,
        email: vet.email,
      }));

    return res.status(200).json({ status: 'SUCCESS', data: { vets } });
  } catch (error) {
    console.error('Get backup vets error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while loading backup vets' });
  }
};

export const submitResignation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    if (req.user.userType !== 'veterinarian') {
      return res.status(403).json({ status: 'ERROR', message: 'Only veterinarians can submit resignation' });
    }

    const { backupVetId } = req.body;
    if (!backupVetId) {
      return res.status(400).json({ status: 'ERROR', message: 'Backup veterinarian is required' });
    }

    const existingPending = await Resignation.findOne({
      vetId: req.user.userId,
      status: { $in: ['pending', 'approved'] },
    });

    if (existingPending) {
      return res.status(400).json({ status: 'ERROR', message: 'You already have an active resignation request' });
    }

    const context = await getVetClinicContext(req.user.userId);
    if (!context) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic assignment not found' });
    }

    const backupVet = await User.findById(backupVetId).select('firstName lastName userType');
    if (!backupVet || backupVet.userType !== 'veterinarian') {
      return res.status(404).json({ status: 'ERROR', message: 'Selected backup veterinarian is invalid' });
    }

    const submittedAt = new Date();

    const resignation = await Resignation.create({
      vetId: req.user.userId,
      clinicId: context.clinicId,
      clinicBranchId: context.clinicBranchId,
      backupVetId,
      status: 'pending',
      submittedAt,
      noticeStart: null,
    });

    await User.findByIdAndUpdate(req.user.userId, {
      $set: {
        'resignation.status': 'pending',
        'resignation.submittedAt': submittedAt,
        'resignation.noticeStart': null,
        'resignation.endDate': null,
        'resignation.backupVetId': backupVetId,
        'resignation.clinicId': context.clinicId,
        'resignation.clinicBranchId': context.clinicBranchId,
        'resignation.rejectionReason': null,
      },
    });

    const vet = await User.findById(req.user.userId).select('firstName lastName');
    const vetName = `${vet?.firstName || ''} ${vet?.lastName || ''}`.trim() || 'Veterinarian';

    await alertClinicAdmins({
      clinicId: context.clinicId,
      clinicBranchId: context.clinicBranchId,
      notificationType: 'clinic_vet_resignation_review',
      notificationTitle: 'Veterinarian Resignation Submitted',
      notificationMessage: `Vet ${vetName} submitted a resignation request. Review and approve/reject in Verification.`,
      metadata: {
        resignationId: resignation._id,
        vetId: req.user.userId,
        backupVetId,
      },
      emailSubject: 'PawSync – Veterinarian Resignation Needs Review',
      emailHeadline: 'Veterinarian Resignation Submitted',
      emailIntro: `Vet ${vetName} submitted a resignation request.`,
      emailDetails: {
        Veterinarian: vetName,
        'Backup Vet': `Dr. ${backupVet.firstName} ${backupVet.lastName}`,
        Action: 'Review at /clinic-admin/verification (Resignations tab)',
      },
    });

    await writeAudit({
      action: 'resignation_submitted',
      actorUserId: req.user.userId,
      targetUserId: req.user.userId,
      clinicId: context.clinicId,
      clinicBranchId: context.clinicBranchId,
      metadata: { resignationId: resignation._id, backupVetId },
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Resignation submitted and pending clinic approval',
      data: { resignation },
    });
  } catch (error) {
    console.error('Submit resignation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while submitting resignation' });
  }
};

export const getClinicResignations = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const filter: any = { clinicId: clinic._id };
    if (req.user.clinicBranchId && !req.user.isMainBranch) {
      filter.clinicBranchId = req.user.clinicBranchId;
    }

    if (typeof req.query.status === 'string' && ['pending', 'approved', 'rejected', 'completed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const resignations = await Resignation.find(filter)
      .populate('vetId', 'firstName lastName email')
      .populate('backupVetId', 'firstName lastName email')
      .populate('clinicBranchId', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: 'SUCCESS', data: { resignations } });
  } catch (error) {
    console.error('Get clinic resignations error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching resignation requests' });
  }
};

export const approveResignation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const filter: any = {
      _id: req.params.resignationId,
      clinicId: clinic._id,
      status: 'pending',
    };

    if (req.user.clinicBranchId && !req.user.isMainBranch) {
      filter.clinicBranchId = req.user.clinicBranchId;
    }

    const resignation = await Resignation.findOne(filter);
    if (!resignation) {
      return res.status(404).json({ status: 'ERROR', message: 'Pending resignation request not found' });
    }

    const noticeStart = new Date();
    const endDate = new Date(noticeStart);
    endDate.setDate(endDate.getDate() + 7);

    resignation.status = 'approved';
    resignation.noticeStart = noticeStart;
    resignation.endDate = endDate;
    resignation.reviewedBy = new mongoose.Types.ObjectId(req.user.userId);
    resignation.reviewedAt = new Date();
    await resignation.save();

    await User.findByIdAndUpdate(resignation.vetId, {
      $set: {
        'resignation.status': 'approved',
        'resignation.noticeStart': noticeStart,
        'resignation.endDate': endDate,
        'resignation.rejectionReason': null,
        'resignation.backupVetId': resignation.backupVetId,
        'resignation.clinicId': resignation.clinicId,
        'resignation.clinicBranchId': resignation.clinicBranchId,
      },
    });

    const futureAppointments = await Appointment.find({
      vetId: resignation.vetId,
      date: { $gt: endDate },
      status: { $in: RESCHEDULABLE_STATUSES },
    })
      .populate('petId', 'name ownerId')
      .populate('ownerId', 'firstName lastName')
      .sort({ date: 1, startTime: 1 });

    let reassignedCount = 0;
    const reassignmentDetails: Array<{ appointmentId: string; petName: string; oldDate: Date; newDate: Date; newStartTime: string }> = [];

    for (const appointment of futureAppointments) {
      const originalDate = new Date(appointment.date);
      const conflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        vetId: resignation.backupVetId,
        date: originalDate,
        startTime: appointment.startTime,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }).select('_id');

      let target = {
        date: originalDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      };

      if (conflict || appointment.isEmergency) {
        const nextSlot = await findNextAvailableSlot({
          backupVetId: resignation.backupVetId.toString(),
          clinicBranchId: resignation.clinicBranchId.toString(),
          date: originalDate,
          originalStartTime: appointment.startTime,
          excludedAppointmentId: appointment._id.toString(),
        });
        if (!nextSlot) continue;
        target = nextSlot;
      }

      appointment.vetId = resignation.backupVetId;
      appointment.date = target.date;
      appointment.startTime = target.startTime;
      appointment.endTime = target.endTime;
      appointment.status = 'rescheduled';
      await appointment.save();

      const pet = appointment.petId as any;
      const owner = appointment.ownerId as any;

      await Pet.findByIdAndUpdate(appointment.petId, { assignedVetId: resignation.backupVetId });
      await MedicalRecord.updateMany({ petId: appointment.petId }, { $set: { vetId: resignation.backupVetId } });
      await Vaccination.updateMany({ petId: appointment.petId }, { $set: { vetId: resignation.backupVetId } });

      reassignedCount++;
      reassignmentDetails.push({
        appointmentId: appointment._id.toString(),
        petName: pet?.name || 'Pet',
        oldDate: originalDate,
        newDate: target.date,
        newStartTime: target.startTime,
      });

      if (owner?._id) {
        await createNotification(
          owner._id.toString(),
          'appointment_reassigned',
          'Appointment Rescheduled Due to Vet Resignation',
          `Your appointment for ${pet?.name || 'your pet'} has been rescheduled to Dr. backup vet on ${target.date.toLocaleDateString()} at ${target.startTime}.`,
          {
            appointmentId: appointment._id,
            newVetId: resignation.backupVetId,
            reason: 'vet_resignation',
          }
        );
      }

      await writeAudit({
        action: 'appointment_reassigned_due_to_resignation',
        actorUserId: req.user.userId,
        targetUserId: resignation.vetId.toString(),
        clinicId: resignation.clinicId,
        clinicBranchId: resignation.clinicBranchId,
        metadata: {
          resignationId: resignation._id,
          appointmentId: appointment._id,
          backupVetId: resignation.backupVetId,
          oldDate: originalDate,
          newDate: target.date,
          newStartTime: target.startTime,
        },
      });
    }

    const resigningVet = await User.findById(resignation.vetId).select('firstName lastName');
    const backupVet = await User.findById(resignation.backupVetId).select('firstName lastName');

    await createNotification(
      resignation.vetId.toString(),
      'vet_resignation_approved',
      'Resignation Approved',
      `Approved. Notice period: ${noticeStart.toLocaleDateString()} to ${endDate.toLocaleDateString()}. Complete appointments and no new bookings beyond end date.`,
      {
        resignationId: resignation._id,
        noticeStart,
        endDate,
      }
    );

    await createNotification(
      resignation.backupVetId.toString(),
      'appointment_reassigned',
      'Appointments Reassigned to You',
      `Reassigned ${reassignedCount} appointment(s) from Dr. ${resigningVet?.firstName || ''} ${resigningVet?.lastName || ''}.`,
      {
        resignationId: resignation._id,
        reassignedCount,
        appointments: reassignmentDetails,
      }
    );

    await alertClinicAdmins({
      clinicId: resignation.clinicId,
      clinicBranchId: resignation.clinicBranchId,
      notificationType: 'clinic_vet_resignation_review',
      notificationTitle: 'Resignation Approved',
      notificationMessage: `Resignation approved for Dr. ${resigningVet?.firstName || ''} ${resigningVet?.lastName || ''}. ${reassignedCount} appointment(s) reassigned.`,
      metadata: {
        resignationId: resignation._id,
        reassignedCount,
      },
      emailSubject: 'PawSync – Resignation Approved Summary',
      emailHeadline: 'Veterinarian Resignation Approved',
      emailIntro: 'A veterinarian resignation request has been approved.',
      emailDetails: {
        Veterinarian: `Dr. ${resigningVet?.firstName || ''} ${resigningVet?.lastName || ''}`,
        'Backup Vet': `Dr. ${backupVet?.firstName || ''} ${backupVet?.lastName || ''}`,
        'Notice Start': noticeStart.toLocaleDateString(),
        'End Date': endDate.toLocaleDateString(),
        'Reassigned Appointments': reassignedCount,
      },
    });

    await writeAudit({
      action: 'resignation_approved',
      actorUserId: req.user.userId,
      targetUserId: resignation.vetId.toString(),
      clinicId: resignation.clinicId,
      clinicBranchId: resignation.clinicBranchId,
      metadata: {
        resignationId: resignation._id,
        noticeStart,
        endDate,
        backupVetId: resignation.backupVetId,
        reassignedCount,
      },
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Resignation approved successfully',
      data: {
        resignation,
        reassignedCount,
        reassignmentDetails,
      },
    });
  } catch (error) {
    console.error('Approve resignation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while approving resignation' });
  }
};

export const rejectResignation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await getClinicForAdmin(req);
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { reason } = req.body;

    const filter: any = {
      _id: req.params.resignationId,
      clinicId: clinic._id,
      status: 'pending',
    };

    if (req.user.clinicBranchId && !req.user.isMainBranch) {
      filter.clinicBranchId = req.user.clinicBranchId;
    }

    const resignation = await Resignation.findOne(filter);
    if (!resignation) {
      return res.status(404).json({ status: 'ERROR', message: 'Pending resignation request not found' });
    }

    resignation.status = 'rejected';
    resignation.rejectionReason = reason || null;
    resignation.reviewedBy = new mongoose.Types.ObjectId(req.user.userId);
    resignation.reviewedAt = new Date();
    await resignation.save();

    await User.findByIdAndUpdate(resignation.vetId, {
      $set: {
        'resignation.status': 'rejected',
        'resignation.noticeStart': null,
        'resignation.endDate': null,
        'resignation.rejectionReason': reason || 'Resignation denied by clinic admin',
        'resignation.backupVetId': resignation.backupVetId,
      },
    });

    await createNotification(
      resignation.vetId.toString(),
      'vet_resignation_rejected',
      'Resignation Denied',
      reason ? `Resignation denied. Reason: ${reason}` : 'Resignation denied.',
      { resignationId: resignation._id }
    );

    await writeAudit({
      action: 'resignation_rejected',
      actorUserId: req.user.userId,
      targetUserId: resignation.vetId.toString(),
      clinicId: resignation.clinicId,
      clinicBranchId: resignation.clinicBranchId,
      metadata: {
        resignationId: resignation._id,
        reason: reason || null,
      },
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Resignation denied',
      data: { resignation },
    });
  } catch (error) {
    console.error('Reject resignation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while rejecting resignation' });
  }
};
