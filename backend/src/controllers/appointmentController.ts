import { Request, Response } from 'express';
import crypto from 'crypto';
import Appointment from '../models/Appointment';
import Pet from '../models/Pet';
import User from '../models/User';
import Clinic from '../models/Clinic';
import VetApplication from '../models/VetApplication';
import ClinicBranch from '../models/ClinicBranch';
import AssignedVet from '../models/AssignedVet';
import VetSchedule from '../models/VetSchedule';
import Vaccination from '../models/Vaccination';
import MedicalRecord from '../models/MedicalRecord';
import Billing from '../models/Billing';
import ProductService from '../models/ProductService';
import AuditTrail from '../models/AuditTrail';
import { sendAppointmentBooked, sendAppointmentCancelled, sendGuestClaimInviteEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import { getClinicForAdmin } from './clinicController';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

/**
 * Generate 30-minute time slots between two "HH:MM" time strings
 */
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
    if (nextM >= 60) { nextH++; nextM -= 60; }
    const nextHStr = nextH.toString().padStart(2, '0');
    const nextMStr = nextM.toString().padStart(2, '0');
    const slotStart = `${hStr}:${mStr}`;
    const slotEnd = `${nextHStr}:${nextMStr}`;

    // Skip slot if it overlaps with the break window
    const overlapsBreak =
      breakStart && breakEnd &&
      slotStart < breakEnd && slotEnd > breakStart;

    if (!overlapsBreak) {
      slots.push({ startTime: slotStart, endTime: slotEnd });
    }
    h = nextH;
    m = nextM;
  }
  return slots;
}

/** Add `minutes` minutes to a "HH:MM" string, returns "HH:MM" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function getAppointmentStartDateTime(dateValue: Date, startTime: string): Date | null {
  const [hourPart, minutePart] = String(startTime || '').split(':');
  const hour = parseInt(hourPart, 10);
  const minute = parseInt(minutePart, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return new Date(
    dateValue.getFullYear(),
    dateValue.getMonth(),
    dateValue.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

function getVetBookingCutoffDate(
  resignation?: { status?: string; noticeStart?: Date | null; endDate?: Date | null } | null
): Date | null {
  if (resignation?.status !== 'approved') return null;

  const cutoff = resignation.noticeStart
    ? new Date(resignation.noticeStart)
    : resignation.endDate
      ? new Date(resignation.endDate)
      : null;

  if (!cutoff) return null;

  if (resignation.noticeStart) {
    cutoff.setDate(cutoff.getDate() + 7);
  }

  cutoff.setHours(23, 59, 59, 999);
  return cutoff;
}

/**
 * Create a new appointment
 */
export const createAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId, vetId, clinicId, clinicBranchId, mode, types, date, startTime, endTime, notes, crossBranchSurgeryReferral } = req.body;

    if (req.user.userType === 'pet-owner' && (!notes || !String(notes).trim())) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Chief complaint is required when booking an appointment.'
      });
    }

    if (req.user.userType === 'veterinarian') {
      const actingVet = await User.findById(req.user.userId).select('resignation');
      const resignationStatus = actingVet?.resignation?.status;
      if (resignationStatus === 'pending' || resignationStatus === 'approved') {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Pending clinic approval. You cannot submit new appointments during resignation processing.'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────────
    // Branch authorization validation
    // ─────────────────────────────────────────────────────────────────────────────────

    // Helper: verify that every type in the request resolves to a Surgery-category
    // product service.  Types are now sent as human-readable names (not ObjectIds)
    // so we query by name.  Uses countDocuments for a single round-trip.
    const assertAllSurgeryTypes = async (): Promise<boolean> => {
      if (!Array.isArray(types) || types.length === 0) return false;
      const count = await ProductService.countDocuments({ name: { $in: types }, category: 'Surgeries' });
      return count === types.length;
    };

    // Helper: verify that the requested clinicBranchId belongs to the same clinic
    // as the requesting user.  Prevents the bypass from being used to book across
    // completely different clinics.
    const assertSameClinic = async (): Promise<boolean> => {
      const targetBranch = await ClinicBranch.findById(clinicBranchId).select('clinicId');
      if (!targetBranch) return false;
      return (targetBranch.clinicId as any).toString() === (clinicId as any).toString();
    };

    // Clinic admins can only book appointments for their assigned branch.
    // Exception: cross-branch surgery referral from the ScheduleSurgeryModal
    // (indicated by crossBranchSurgeryReferral === true) is permitted when all
    // types are Surgery-category services and the target branch belongs to the
    // same clinic.
    if (req.user.userType === 'clinic-admin') {
      if (!req.user.clinicBranchId) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Clinic admin must have a branch assigned'
        });
      }

      const userBranchId = (req.user.clinicBranchId as any).toString();
      const requestedBranchId = (clinicBranchId as any).toString();

      if (userBranchId !== requestedBranchId) {
        // Allow only when explicit surgery-referral flag is set, types are all
        // surgery services, and the target branch is within the same clinic.
        const isCrossBranchSurgeryAllowed =
          crossBranchSurgeryReferral === true &&
          (await assertAllSurgeryTypes()) &&
          (await assertSameClinic());

        if (!isCrossBranchSurgeryAllowed) {
          return res.status(403).json({
            status: 'ERROR',
            message: 'You can only create appointments for your assigned branch'
          });
        }
      }
    }

    // Veterinarians can only book appointments for branches they are assigned to.
    // Same cross-branch surgery referral exception applies.
    if (req.user.userType === 'veterinarian') {
      const vetApps = await VetApplication.find({ vetId: req.user.userId });
      const assignedBranchIds = vetApps.map(va => (va.branchId as any).toString());
      const requestedBranchId = (clinicBranchId as any).toString();

      if (!assignedBranchIds.includes(requestedBranchId)) {
        const isCrossBranchSurgeryAllowed =
          crossBranchSurgeryReferral === true &&
          (await assertAllSurgeryTypes()) &&
          (await assertSameClinic());

        if (!isCrossBranchSurgeryAllowed) {
          return res.status(403).json({
            status: 'ERROR',
            message: 'You can only create appointments for branches you are assigned to'
          });
        }
      }
    }

    // Verify pet belongs to the user
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }
    if (pet.ownerId.toString() !== req.user.userId && req.user.userType !== 'veterinarian' && req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'You can only book appointments for your own pets' });
    }

    if (!pet.isAlive || pet.status === 'deceased') {
      return res.status(403).json({
        status: 'ERROR',
        message: `Cannot schedule an appointment for ${pet.name} because the pet is marked as deceased.`
      });
    }

    // Check if pet is marked as lost
    if (pet.isLost) {
      return res.status(403).json({ 
        status: 'ERROR', 
        message: `Cannot schedule an appointment for ${pet.name} as they are marked as lost. Please update their status once they are found.` 
      });
    }

    // Validate types based on mode
    if (mode === 'online') {
      if (types.length !== 1 || types[0] !== 'consultation') {
        return res.status(400).json({ status: 'ERROR', message: 'Online appointments can only be for consultation' });
      }
    }

    const appointmentDate = new Date(date);
    if (Number.isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment date' });
    }

    const appointmentStartDateTime = getAppointmentStartDateTime(appointmentDate, startTime);
    if (!appointmentStartDateTime) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment start time' });
    }

    if (appointmentStartDateTime.getTime() < Date.now()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Cannot book an appointment in the past'
      });
    }

    // Check if appointment is grooming-only (no vet required) or requires vet
    const hasGrooming = types.some((t: string) => t === 'basic-grooming' || t === 'full-grooming');
    const hasOtherServices = types.some((t: string) => t !== 'basic-grooming' && t !== 'full-grooming');

    // Grooming cannot be combined with medical services
    if (hasGrooming && hasOtherServices) {
      return res.status(400).json({ status: 'ERROR', message: 'Grooming services cannot be combined with medical services in one appointment' });
    }

    // If it's grooming-only, vetId can be null; if it has other services, vetId is required
    if (hasOtherServices && !vetId) {
      return res.status(400).json({ status: 'ERROR', message: 'A veterinarian must be selected for this appointment type' });
    }

    if (hasOtherServices && vetId) {
      const selectedVet = await User.findById(vetId).select('resignation userType');
      if (!selectedVet || selectedVet.userType !== 'veterinarian') {
        return res.status(400).json({ status: 'ERROR', message: 'Selected veterinarian is not available' });
      }

      const bookingCutoff = getVetBookingCutoffDate(selectedVet.resignation as any);
      if (bookingCutoff) {
        const appointmentDateForVet = new Date(date);
        if (appointmentDateForVet > bookingCutoff) {
          return res.status(400).json({
            status: 'ERROR',
            message: `Vet unavailable after ${bookingCutoff.toLocaleDateString('en-US')}`
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────────
    // Pet-specific conflict validation
    // ─────────────────────────────────────────────────────────────────────────────────

    const startOfDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    const endOfDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate() + 1);

    // 1. If grooming-only appointment, prevent multiple grooming appointments on the same day
    if (hasGrooming && !hasOtherServices) {
      const existingGroomingOnDay = await Appointment.findOne({
        petId: petId,
        date: { $gte: startOfDay, $lt: endOfDay },
        types: { $in: ['basic-grooming', 'full-grooming'] },
        status: { $in: ['pending', 'confirmed'] }
      });

      if (existingGroomingOnDay) {
        return res.status(409).json({
          status: 'ERROR',
          message: 'This dog already has a grooming appointment scheduled for this day. Only one grooming appointment per dog is allowed per day.'
        });
      }
    }

    // 2. Prevent appointments (both grooming and medical) at the exact same time
    const existingAtSameTime = await Appointment.findOne({
      petId: petId,
      date: { $gte: startOfDay, $lt: endOfDay },
      startTime: startTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAtSameTime) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'This dog already has an appointment scheduled at this time. Please choose a different time.'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────────
    // Slot availability validation (clinic/vet level)
    // ─────────────────────────────────────────────────────────────────────────────────

    // Check if the slot is already taken
    let existingQuery: any = {
      date: new Date(date),
      startTime,
      status: { $in: ['pending', 'confirmed', 'rescheduled'] }
    };
    
    if (hasGrooming && !hasOtherServices) {
      // Grooming-only: check by branch
      existingQuery.clinicBranchId = clinicBranchId;
      existingQuery.types = { $in: ['basic-grooming', 'full-grooming'] };
    } else {
      // Medical: check by vet
      existingQuery.vetId = vetId;
    }

    const slotExists = await Appointment.findOne(existingQuery);

    if (slotExists) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }

    const appointment = await Appointment.create({
      petId,
      ownerId: req.user.userId,
      vetId: vetId || null,
      clinicId,
      clinicBranchId,
      mode,
      types,
      date: new Date(date),
      startTime,
      endTime,
      notes: notes || null,
      status: 'confirmed'
    });

    // Fetch related data for email + notification (fire-and-forget)
    Promise.all([
      User.findById(req.user.userId).select('firstName lastName email'),
      User.findById(vetId).select('firstName lastName'),
      ClinicBranch.findById(clinicBranchId).select('name'),
    ]).then(async ([owner, vet, branch]) => {
      const dateStr = appointment.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const vetName = vet ? `Dr. ${vet.firstName} ${vet.lastName}` : 'your vet';
      const clinicName = branch?.name ?? 'the clinic';

      // Always create the in-app notification
      await createNotification(
        req.user!.userId,
        'appointment_scheduled',
        'New Appointment Scheduled',
        `Your appointment for ${pet.name} with ${vetName} at ${clinicName} on ${dateStr} at ${appointment.startTime} has been confirmed.`,
        { appointmentId: appointment._id }
      );

      // Send email only if we have the required fields
      if (owner?.email && vet && branch) {
        sendAppointmentBooked({
          ownerEmail: owner.email,
          ownerFirstName: owner.firstName,
          petName: pet.name,
          vetName: `${vet.firstName} ${vet.lastName}`,
          clinicName: branch.name,
          date: appointment.date,
          startTime: appointment.startTime,
          types: appointment.types,
          mode: appointment.mode,
        });
      }

      if (req.user?.userType === 'pet-owner') {
        const ownerFullName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim() || 'Pet Owner';
        await alertClinicAdmins({
          clinicId: appointment.clinicId,
          clinicBranchId: appointment.clinicBranchId,
          notificationType: 'clinic_new_appointment_booked',
          notificationTitle: 'New Appointment Booked by Pet Owner',
          notificationMessage: `${ownerFullName} booked an appointment for ${pet.name} on ${dateStr} at ${appointment.startTime} (${appointment.types.join(', ')}).`,
          metadata: {
            appointmentId: appointment._id,
            petId: pet._id,
            ownerId: owner?._id,
            branchId: appointment.clinicBranchId,
          },
          emailSubject: `PawSync – New Appointment Booked (${pet.name})`,
          emailHeadline: 'New Appointment Booked by Pet Owner',
          emailIntro: `${ownerFullName} scheduled an appointment that may need clinic coordination.`,
          emailDetails: {
            Pet: pet.name,
            Owner: ownerFullName,
            Date: dateStr,
            Time: appointment.startTime,
            'Service Type': appointment.types.join(', '),
            Branch: clinicName,
          },
        });
      }
    }).catch((err) => {
      console.error('[Appointment] Post-create notification/email error:', err);
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Appointment booked successfully',
      data: { appointment }
    });
  } catch (error: any) {
    console.error('Create appointment error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while booking the appointment' });
  }
};

/**
 * Get available time slots for a vet on a given date
 * Uses VetSchedule if set, falls back to branch hours, then hardcoded 7AM–5PM
 */
export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { vetId, date, branchId } = req.query;

    if (!vetId || !date) {
      return res.status(400).json({ status: 'ERROR', message: 'vetId and date are required' });
    }

    const selectedVet = await User.findById(vetId as string).select('resignation');
    const bookingCutoff = getVetBookingCutoffDate(selectedVet?.resignation as any);
    if (bookingCutoff) {
      const requestedDate = new Date(date as string);
      if (requestedDate > bookingCutoff) {
        return res.status(400).json({
          status: 'ERROR',
          message: `Vet unavailable after ${bookingCutoff.toLocaleDateString('en-US')}`,
          data: { unavailableAfter: bookingCutoff }
        });
      }
    }

    // Determine the day-of-week for the requested date (parse locally to avoid timezone issues)
    const [yr, mo, dy] = (date as string).split('-').map(Number);
    const dayName = DAY_NAMES[new Date(yr, mo - 1, dy).getDay()];

    // Resolve working hours: vet schedule → branch hours → default 7–17
    let slotStart = '07:00';
    let slotEnd = '17:00';
    let slotBreakStart: string | null = null;
    let slotBreakEnd: string | null = null;
    let isClosed = false;

    if (branchId) {
      const vetSchedule = await VetSchedule.findOne({
        vetId: vetId as string,
        branchId: branchId as string
      });

      if (vetSchedule) {
        // Use vet's own schedule
        if (!vetSchedule.workingDays.includes(dayName)) {
          isClosed = true;
        } else {
          slotStart = vetSchedule.startTime;
          slotEnd = vetSchedule.endTime;
          slotBreakStart = vetSchedule.breakStart ?? null;
          slotBreakEnd = vetSchedule.breakEnd ?? null;
        }
      } else {
        // Fall back to branch operating hours
        const branch = await ClinicBranch.findById(branchId as string);
        if (branch) {
          if (branch.operatingDays.length > 0 && !branch.operatingDays.includes(dayName)) {
            isClosed = true;
          } else {
            if (branch.openingTime) slotStart = branch.openingTime;
            if (branch.closingTime) slotEnd = branch.closingTime;
          }
        }
      }
    }

    if (isClosed) {
      return res.status(200).json({ status: 'SUCCESS', data: { slots: [], isClosed: true } });
    }

    const [qy, qm, qd] = (date as string).split('-').map(Number);
    const dayStart = new Date(Date.UTC(qy, qm - 1, qd, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(qy, qm - 1, qd, 23, 59, 59, 999));

    // Get all booked/confirmed slots for that vet on that date
    const booked = await Appointment.find({
      vetId: vetId as string,
      date: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] }
    }).select('startTime endTime status ownerId');

    const allSlots = generateTimeSlots(slotStart, slotEnd, slotBreakStart, slotBreakEnd);

    const slots = allSlots.map((slot) => {
      const bookedSlot = booked.find((b) => b.startTime === slot.startTime);
      const status: 'available' | 'unavailable' = bookedSlot ? 'unavailable' : 'available';
      return { ...slot, status };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { slots, isClosed: false }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching available slots' });
  }
};

/**
 * Get available time slots for grooming based on clinic branch operating hours
 * Uses branch's operating hours for grooming scheduling
 */
export const getGroomingSlots = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { branchId, date } = req.query;

    if (!branchId || !date) {
      return res.status(400).json({ status: 'ERROR', message: 'branchId and date are required' });
    }

    // Determine the day-of-week for the requested date
    const [yr, mo, dy] = (date as string).split('-').map(Number);
    const dayName = DAY_NAMES[new Date(yr, mo - 1, dy).getDay()];

    // Get branch operating hours
    let slotStart = '07:00';
    let slotEnd = '17:00';
    let isClosed = false;

    const branch = await ClinicBranch.findById(branchId as string);
    if (branch) {
      if (branch.operatingDays.length > 0 && !branch.operatingDays.includes(dayName)) {
        isClosed = true;
      } else {
        if (branch.openingTime) slotStart = branch.openingTime;
        if (branch.closingTime) slotEnd = branch.closingTime;
      }
    }

    if (isClosed) {
      return res.status(200).json({ status: 'SUCCESS', data: { slots: [], isClosed: true } });
    }

    const [qy, qm, qd] = (date as string).split('-').map(Number);
    const dayStart = new Date(Date.UTC(qy, qm - 1, qd, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(qy, qm - 1, qd, 23, 59, 59, 999));

    // Get all booked/confirmed grooming slots for that branch on that date
    const booked = await Appointment.find({
      clinicBranchId: branchId as string,
      date: { $gte: dayStart, $lte: dayEnd },
      types: { $in: ['basic-grooming', 'full-grooming'] },
      status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] }
    }).select('startTime endTime status ownerId');

    const allSlots = generateTimeSlots(slotStart, slotEnd);

    const slots = allSlots.map((slot) => {
      const bookedSlot = booked.find((b) => b.startTime === slot.startTime);
      const status: 'available' | 'unavailable' = bookedSlot ? 'unavailable' : 'available';
      return { ...slot, status };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { slots, isClosed: false }
    });
  } catch (error) {
    console.error('Get grooming slots error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching grooming slots' });
  }
};

/**
 * Get appointments for the authenticated user (pet owner)
 */
export const getMyAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const filter = req.query.filter as string; // 'upcoming' or 'previous'

    const query: any = { ownerId: req.user.userId };

    // Get today at midnight for date comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow at midnight for clean separation
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (filter === 'upcoming') {
      // Upcoming: date is today or later AND status is pending or confirmed
      query.date = { $gte: today };
      query.status = { $in: ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress'] };
    } else if (filter === 'previous') {
      // Previous: date is before today OR status is completed/cancelled
      query.$or = [
        { date: { $lt: today }, status: { $ne: 'pending' } },
        { status: { $in: ['completed', 'cancelled'] } }
      ];
    }

    const appointments = await Appointment.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .sort({ date: filter === 'upcoming' ? 1 : -1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching appointments' });
  }
};

/**
 * Get appointments for a vet
 */
export const getVetAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vet = await User.findById(req.user.userId).select('resignation');
    const vetQuery: any = { vetId: req.user.userId };
    if (vet?.resignation?.status === 'approved' && vet.resignation.endDate) {
      vetQuery.date = { $lte: vet.resignation.endDate };
      vetQuery.status = { $in: ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress', 'completed', 'cancelled'] };
    }

    const appointments = await Appointment.find(vetQuery)
      .populate('petId', 'name species breed photo sex dateOfBirth color sterilization nfcTagId microchipNumber allergies status isAlive isLost removedByOwner')
      .populate('ownerId', 'firstName lastName email')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .sort({ date: -1, startTime: 1 })
      .lean();

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get vet appointments error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while fetching appointments';
    return res.status(500).json({ status: 'ERROR', message });
  }
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    const isOwner = appointment.ownerId.toString() === req.user.userId;
    const isVet = appointment.vetId ? appointment.vetId.toString() === req.user.userId : false;
    const isAdmin = req.user.userType === 'clinic-admin';

    if (!isOwner && !isVet && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to cancel this appointment' });
    }

    if (isVet) {
      const vet = await User.findById(req.user.userId).select('resignation');
      if (vet?.resignation?.status === 'approved') {
        return res.status(403).json({
          status: 'ERROR',
          message: 'During notice period, vets must complete existing appointments and cannot cancel them.'
        });
      }
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({ status: 'ERROR', message: `Cannot cancel a ${appointment.status} appointment` });
    }

    if (isVet && (appointment.status === 'in_clinic' || appointment.status === 'in_progress')) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Vets cannot cancel appointments once the visit has started.'
      });
    }

    if (isOwner) {
      if (appointment.status === 'in_progress') {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Cannot cancel appointment once it is in progress.'
        });
      }

      const ownerCancellableStatuses = ['confirmed', 'in_clinic'];
      if (!ownerCancellableStatuses.includes(appointment.status)) {
        return res.status(403).json({
          status: 'ERROR',
          message: `Pet owners can only cancel confirmed or in-clinic appointments.`
        });
      }
    }

    if (isAdmin) {
      const clinicAdminCancellableStatuses = ['confirmed', 'in_clinic'];
      if (!clinicAdminCancellableStatuses.includes(appointment.status)) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Clinic admins can only cancel confirmed or in-clinic appointments.'
        });
      }
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Send cancellation email + notification (fire-and-forget)
    Promise.all([
      User.findById(appointment.ownerId).select('firstName email'),
      User.findById(appointment.vetId).select('firstName lastName'),
      Pet.findById(appointment.petId).select('name'),
      ClinicBranch.findById(appointment.clinicBranchId).select('name'),
    ]).then(async ([owner, vet, pet, branch]) => {
      const dateStr = appointment.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const petName = (pet as any)?.name ?? 'your pet';

      await createNotification(
        appointment.ownerId.toString(),
        'appointment_cancelled',
        'Appointment Cancelled',
        `Your appointment for ${petName} on ${dateStr} at ${appointment.startTime} has been cancelled.`,
        { appointmentId: appointment._id }
      );

      if (owner?.email && vet && pet) {
        sendAppointmentCancelled({
          ownerEmail: owner.email,
          ownerFirstName: owner.firstName,
          petName: (pet as any).name,
          vetName: `${vet.firstName} ${vet.lastName}`,
          date: appointment.date,
          startTime: appointment.startTime,
        });
      }

      if (isOwner) {
        await alertClinicAdmins({
          clinicId: appointment.clinicId,
          clinicBranchId: appointment.clinicBranchId,
          notificationType: 'clinic_appointment_cancelled',
          notificationTitle: 'Appointment Cancelled by Pet Owner',
          notificationMessage: `${owner?.firstName || 'A pet owner'} cancelled an appointment for ${petName} on ${dateStr} at ${appointment.startTime}.`,
          metadata: {
            appointmentId: appointment._id,
            petId: appointment.petId,
            ownerId: appointment.ownerId,
            branchId: appointment.clinicBranchId,
          },
          emailSubject: `PawSync – Appointment Cancelled (${petName})`,
          emailHeadline: 'Appointment Cancelled by Pet Owner',
          emailIntro: `A pet owner cancelled an existing appointment.`,
          emailDetails: {
            Pet: petName,
            Owner: owner?.firstName || 'Pet Owner',
            Date: dateStr,
            Time: appointment.startTime,
            Branch: (branch as any)?.name || 'Clinic Branch',
            Services: appointment.types.join(', '),
          },
        });
      }
    }).catch((err) => {
      console.error('[Appointment] Cancellation notification/email error:', err);
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while cancelling the appointment' });
  }
};

/**
 * Update appointment status (vet confirms / completes)
 */
export const updateAppointmentStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    const isAdmin = req.user.userType === 'clinic-admin';
    const isAssignedVet = appointment.vetId ? appointment.vetId.toString() === req.user.userId : false;
    if (!isAdmin && !isAssignedVet) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to update this appointment' });
    }

    const { status } = req.body;
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'rescheduled': ['confirmed', 'in_clinic', 'in_progress', 'cancelled'],
      'confirmed': ['in_clinic', 'in_progress', 'cancelled'],
      'in_clinic': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled']
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
      return res.status(400).json({ status: 'ERROR', message: `Cannot change status from ${appointment.status} to ${status}` });
    }

    // When checking in (confirmed → in_progress), auto-create a draft medical record
    // only for appointments that have an assigned vet.
    let medicalRecordId: string | undefined;
    if (status === 'in_progress' && appointment.vetId) {
      const resolvedServiceLabel = formatAppointmentTypesForServiceLabel(appointment.types || []);
      const resolvedServiceDate = appointment.date ? new Date(appointment.date) : new Date();

      const existingRecord = await MedicalRecord.findOne({ appointmentId: appointment._id });
      if (!existingRecord) {
        // Mark any previous current records for this pet as historical
        await MedicalRecord.updateMany(
          { petId: appointment.petId, isCurrent: true },
          { $set: { isCurrent: false } }
        );

        const [owner, vet] = await Promise.all([
          User.findById(appointment.ownerId).select('firstName lastName'),
          User.findById(appointment.vetId).select('firstName lastName'),
        ]);
        const ownerName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'Unknown Owner';
        const vetName = `${vet?.firstName || ''} ${vet?.lastName || ''}`.trim() || 'Unknown Vet';

        const record = await MedicalRecord.create({
          petId: appointment.petId,
          ownerId: appointment.ownerId,
          petIsAlive: true,
          ownerAtTime: {
            name: ownerName,
            id: owner?._id ?? null,
          },
          vetAtTime: {
            name: vetName,
            id: vet?._id ?? null,
          },
          vetId: appointment.vetId,
          clinicId: appointment.clinicId,
          clinicBranchId: appointment.clinicBranchId,
          appointmentId: appointment._id,
          stage: 'pre_procedure',
          isCurrent: true,
          chiefComplaint: appointment.notes || '',
        });
        medicalRecordId = record._id.toString();
        appointment.medicalRecordId = record._id;
        await appointment.save();

        // Auto-create a billing record linked to this medical record
        const existingBilling = await Billing.findOne({ medicalRecordId: record._id });
        if (!existingBilling) {
          const billing = await Billing.create({
            ownerId: appointment.ownerId,
            petId: appointment.petId,
            vetId: appointment.vetId,
            clinicId: appointment.clinicId,
            clinicBranchId: appointment.clinicBranchId,
            medicalRecordId: record._id,
            appointmentId: appointment._id,
            items: [],
            subtotal: 0,
            discount: 0,
            totalAmountDue: 0,
            serviceLabel: resolvedServiceLabel,
            serviceDate: resolvedServiceDate,
          });
          await MedicalRecord.findByIdAndUpdate(record._id, { billingId: billing._id });
        }
      } else {
        medicalRecordId = existingRecord._id.toString();
        if (!appointment.medicalRecordId) {
          appointment.medicalRecordId = existingRecord._id;
          await appointment.save();
        }

        // Auto-create billing if it doesn't exist yet for this record
        const existingBilling = await Billing.findOne({ medicalRecordId: existingRecord._id });
        if (!existingBilling) {
          const billing = await Billing.create({
            ownerId: appointment.ownerId,
            petId: appointment.petId,
            vetId: appointment.vetId,
            clinicId: appointment.clinicId,
            clinicBranchId: appointment.clinicBranchId,
            medicalRecordId: existingRecord._id,
            appointmentId: appointment._id,
            items: [],
            subtotal: 0,
            discount: 0,
            totalAmountDue: 0,
            serviceLabel: resolvedServiceLabel,
            serviceDate: resolvedServiceDate,
          });
          await MedicalRecord.findByIdAndUpdate(existingRecord._id, { billingId: billing._id });
        }
      }
    }

    appointment.status = status;
    await appointment.save();

    // Auto-create a pending vaccination draft when appointment is completed
    let vaccinationId: string | undefined;
    if (status === 'completed' && appointment.types.includes('vaccination')) {
      const existingVax = await Vaccination.findOne({ appointmentId: appointment._id });
      if (!existingVax) {
        const vax = await Vaccination.create({
          petId: appointment.petId,
          vetId: appointment.vetId,
          clinicId: appointment.clinicId,
          clinicBranchId: appointment.clinicBranchId,
          appointmentId: appointment._id,
          vaccineName: 'Pending — to be filled by vet',
          status: 'pending',
        });
        vaccinationId = vax._id.toString();
      } else {
        vaccinationId = existingVax._id.toString();
      }
    }

    // When appointment is completed, update the pet's assigned vet
    if (status === 'completed' && appointment.vetId) {
      Pet.findByIdAndUpdate(appointment.petId, { assignedVetId: appointment.vetId }).catch((err) => {
        console.error('[Pet] Failed to update assignedVetId:', err);
      });
    }

    // Notify owner when appointment is completed
    if (status === 'completed') {
      Pet.findById(appointment.petId).select('name').then(async (pet) => {
        const petName = (pet as any)?.name ?? 'your pet';
        await createNotification(
          appointment.ownerId.toString(),
          'appointment_completed',
          'Clinic Visit Completed',
          `The clinic visit for ${petName} has been completed. Thank you for visiting us!`,
          { appointmentId: appointment._id }
        );
      }).catch((err) => {
        console.error('[Notification] Appointment completed notification error:', err);
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Appointment ${status} successfully`,
      data: {
        appointment,
        ...(medicalRecordId ? { medicalRecordId } : {}),
        ...(vaccinationId ? { vaccinationId } : {})
      }
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Reschedule an appointment to a new date/time (clinic admin)
 */
export const rescheduleAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
      return res.status(400).json({ status: 'ERROR', message: 'Can only reschedule pending or confirmed appointments' });
    }

    const { date, startTime, endTime } = req.body;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ status: 'ERROR', message: 'Date, start time, and end time are required' });
    }

    const oldDate = appointment.date;
    const oldStartTime = appointment.startTime;
    const oldEndTime = appointment.endTime;

    // Check if the new slot is available.
    // Grooming-only appointments may not have a vet assignment, so conflict by branch + grooming types.
    const groomingTypes = ['basic-grooming', 'full-grooming'];
    const hasGrooming = appointment.types.some((t) => groomingTypes.includes(t));
    const hasMedical = appointment.types.some((t) => !groomingTypes.includes(t));
    const isGroomingOnly = hasGrooming && !hasMedical;

    const conflictQuery: any = {
      _id: { $ne: appointment._id },
      date: new Date(date),
      startTime,
      status: { $in: ['pending', 'confirmed', 'rescheduled'] }
    };

    if (isGroomingOnly) {
      conflictQuery.clinicBranchId = appointment.clinicBranchId;
      conflictQuery.types = { $in: groomingTypes };
    } else {
      conflictQuery.vetId = appointment.vetId;
    }

    const conflict = await Appointment.findOne(conflictQuery);

    if (conflict) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }

    appointment.date = new Date(date);
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    await appointment.save();

    // Notify owner of reschedule
    Promise.all([
      Pet.findById(appointment.petId).select('name'),
      ClinicBranch.findById(appointment.clinicBranchId).select('name'),
    ]).then(async ([pet, branch]) => {
      const petName = (pet as any)?.name ?? 'your pet';
      const dateStr = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const oldDateStr = oldDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      await createNotification(
        appointment.ownerId.toString(),
        'appointment_rescheduled',
        'Appointment Rescheduled',
        `Your appointment for ${petName} has been rescheduled to ${dateStr} at ${startTime}.`,
        { appointmentId: appointment._id }
      );

      await alertClinicAdmins({
        clinicId: appointment.clinicId,
        clinicBranchId: appointment.clinicBranchId,
        notificationType: 'clinic_appointment_rescheduled',
        notificationTitle: 'Appointment Rescheduled',
        notificationMessage: `${petName}'s appointment moved from ${oldDateStr} ${oldStartTime}-${oldEndTime} to ${dateStr} ${startTime}-${endTime}.`,
        metadata: {
          appointmentId: appointment._id,
          petId: appointment.petId,
          ownerId: appointment.ownerId,
          oldDate,
          oldStartTime,
          oldEndTime,
          newDate: appointment.date,
          newStartTime: appointment.startTime,
          newEndTime: appointment.endTime,
          branchId: appointment.clinicBranchId,
        },
        emailSubject: `PawSync – Appointment Rescheduled (${petName})`,
        emailHeadline: 'Appointment Rescheduled',
        emailIntro: `An appointment schedule has been updated.`,
        emailDetails: {
          Pet: petName,
          Branch: (branch as any)?.name || 'Clinic Branch',
          'Old Schedule': `${oldDateStr}, ${oldStartTime}-${oldEndTime}`,
          'New Schedule': `${dateStr}, ${startTime}-${endTime}`,
          Services: appointment.types.join(', '),
        },
      });
    }).catch((err) => console.error('[Notification] Reschedule notification error:', err));

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Appointment rescheduled successfully',
      data: { appointment }
    });
  } catch (error) {
    console.error('Reschedule appointment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while rescheduling' });
  }
};

/**
 * Get approved vets for a specific clinic branch (for appointment booking)
 */
export const getVetsForBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'branchId is required' });
    }

    // Verify branch exists
    const branch = await ClinicBranch.findOne({ _id: branchId });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Find active vet assignments for this branch
    const activeAssignments = await AssignedVet.find({
      clinicBranchId: branchId as string,
      isActive: true,
      petId: null,
    }).populate('vetId', 'firstName lastName email userType resignation');

    const vets = activeAssignments
      .filter((a) => a.vetId && (a.vetId as any).userType === 'veterinarian')
      .map((a) => {
        const vet = a.vetId as any;
        const unavailableAfter = getVetBookingCutoffDate(vet?.resignation || null);
        return {
          _id: vet._id,
          firstName: vet.firstName,
          lastName: vet.lastName,
          email: vet.email,
          resignationStatus: vet?.resignation?.status || null,
          resignationEndDate: vet?.resignation?.endDate || null,
          unavailableAfter,
        };
      });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vets }
    });
  } catch (error) {
    console.error('Get vets for branch error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vets' });
  }
};

// ==================== CLINIC ADMIN ENDPOINTS ====================

/**
 * Search pet owners by name (clinic admin)
 */
export const searchPetOwners = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { q } = req.query;
    if (!q || (q as string).trim().length < 2) {
      return res.status(200).json({ status: 'SUCCESS', data: { owners: [] } });
    }

    const searchRegex = new RegExp((q as string).trim(), 'i');
    const owners = await User.find({
      userType: 'pet-owner',
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    })
      .select('firstName lastName email')
      .limit(20)
      .sort({ firstName: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { owners }
    });
  } catch (error) {
    console.error('Search pet owners error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while searching pet owners' });
  }
};

/**
 * Get pets for a specific owner (clinic admin)
 */
export const getPetsForOwner = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId is required' });
    }

    const pets = await Pet.find({ ownerId: ownerId as string })
      .select('name species breed photo isLost isAlive status deceasedAt')
      .sort({ name: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { pets }
    });
  } catch (error) {
    console.error('Get pets for owner error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching pets' });
  }
};

/**
 * Create an appointment on behalf of a pet owner (clinic admin)
 */
export const createClinicAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let { ownerId, petId, vetId, clinicId, clinicBranchId, mode, types, date, startTime, endTime, notes, isWalkIn, isEmergency } = req.body;

    if (!ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'Owner is required' });
    }

    // Verify the pet belongs to the specified owner
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }
    if (pet.ownerId.toString() !== ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet does not belong to the selected owner' });
    }

    if (!pet.isAlive || pet.status === 'deceased') {
      return res.status(403).json({
        status: 'ERROR',
        message: `Cannot schedule an appointment for ${pet.name} because the pet is marked as deceased.`
      });
    }

    if (pet.isLost) {
      return res.status(403).json({
        status: 'ERROR',
        message: `Cannot schedule an appointment for ${pet.name} as they are marked as lost. Please update their status once they are found.`
      });
    }

    const clinicAppointmentDate = new Date(date);
    if (Number.isNaN(clinicAppointmentDate.getTime())) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment date' });
    }

    const clinicAppointmentStartDateTime = getAppointmentStartDateTime(clinicAppointmentDate, startTime);
    if (!clinicAppointmentStartDateTime) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment start time' });
    }

    if (clinicAppointmentStartDateTime.getTime() < Date.now()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Cannot book an appointment in the past'
      });
    }

    // Validate types based on mode
    if (mode === 'online') {
      if (types.length !== 1 || types[0] !== 'consultation') {
        return res.status(400).json({ status: 'ERROR', message: 'Online appointments can only be for consultation' });
      }
    }

    // Grooming cannot be combined with medical services
    const hasClinicGrooming = types.some((t: string) => t === 'basic-grooming' || t === 'full-grooming');
    const hasClinicMedical = types.some((t: string) => t !== 'basic-grooming' && t !== 'full-grooming');
    if (hasClinicGrooming && hasClinicMedical) {
      return res.status(400).json({ status: 'ERROR', message: 'Grooming services cannot be combined with medical services in one appointment' });
    }

    // Validate vet requirements: medical appointments need a vet, grooming-only does not
    if (hasClinicMedical && !vetId) {
      return res.status(400).json({ status: 'ERROR', message: 'A veterinarian must be selected for medical appointments' });
    }
    if (hasClinicMedical && vetId) {
      const selectedVet = await User.findById(vetId).select('userType resignation');
      if (!selectedVet || selectedVet.userType !== 'veterinarian') {
        return res.status(400).json({ status: 'ERROR', message: 'Selected veterinarian is not available' });
      }

      const bookingCutoff = getVetBookingCutoffDate(selectedVet.resignation as any);
      if (bookingCutoff) {
        const appointmentDateForVet = new Date(date);
        if (appointmentDateForVet > bookingCutoff) {
          return res.status(400).json({
            status: 'ERROR',
            message: `Vet unavailable after ${bookingCutoff.toLocaleDateString('en-US')}`
          });
        }
      }
    }
    // For grooming-only appointments, clear vetId to null
    if (hasClinicGrooming && !hasClinicMedical) {
      vetId = null;
    }

    // Check if the slot is already taken (skip for emergency appointments)
    if (!isEmergency) {
      // For grooming appointments, we don't need a vet, so skip the vetId-based check
      if (hasClinicMedical && vetId) {
        const existing = await Appointment.findOne({
          vetId,
          date: new Date(date),
          startTime,
          status: { $in: ['pending', 'confirmed', 'rescheduled'] }
        });

        if (existing) {
          return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
        }
      }
    }

    // For emergency appointments, push all overlapping/subsequent appointments down by 30 min.
    // If pushed time exceeds vet's working hours, reschedule to the next available working day.
    let rescheduledAppointments: any[] = [];
    if (isEmergency) {
      // Resolve vet working hours for this branch
      let schedSlotStart = '07:00';
      let schedSlotEnd = '17:00';
      let schedBreakStart: string | null = null;
      let schedBreakEnd: string | null = null;
      let vetSchedDoc: any = null;
      let branchFallbackDoc: any = null;

      const vetSched = await VetSchedule.findOne({ vetId, branchId: clinicBranchId });
      if (vetSched) {
        vetSchedDoc = vetSched;
        schedSlotStart = vetSched.startTime;
        schedSlotEnd = vetSched.endTime;
        schedBreakStart = vetSched.breakStart ?? null;
        schedBreakEnd = vetSched.breakEnd ?? null;
      } else {
        const branch = await ClinicBranch.findById(clinicBranchId);
        branchFallbackDoc = branch;
        if (branch?.openingTime) schedSlotStart = branch.openingTime;
        if (branch?.closingTime) schedSlotEnd = branch.closingTime;
      }

      // Fetch all appointments on the same day at or after the emergency slot.
      // We'll cascade only those that actually collide, stopping at the first gap.
      const emergencyDayStart = new Date(date);
      emergencyDayStart.setUTCHours(0, 0, 0, 0);
      const emergencyDayEnd = new Date(date);
      emergencyDayEnd.setUTCHours(23, 59, 59, 999);
      const sameDay = await Appointment.find({
        vetId,
        date: { $gte: emergencyDayStart, $lte: emergencyDayEnd },
        startTime: { $gte: startTime },
        status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] }
      }).sort({ startTime: 1 });

      // pushTo: the earliest time that is occupied by the chain reaction.
      // Starts at the emergency appointment's endTime.
      let pushTo = endTime;

      for (const appt of sameDay) {
        // Gap found — this appointment starts at or after the filled boundary, no cascade needed
        if (appt.startTime >= pushTo) break;

        const newStart = pushTo;
        const newEnd = addMinutes(pushTo, 30);

        if (newEnd <= schedSlotEnd) {
          // Still within working hours — shift to fill the gap left by the cascade
          appt.startTime = newStart;
          appt.endTime = newEnd;
          await appt.save();
          pushTo = newEnd; // advance the cascade pointer
          rescheduledAppointments.push(appt);
        } else {
          // Exceeds working hours — find the next available working day slot
          const apptYear = (appt.date as Date).getUTCFullYear();
          const apptMonth = (appt.date as Date).getUTCMonth();
          const apptDay = (appt.date as Date).getUTCDate();

          let nextDate: Date | null = null;
          let nextStart: string | null = null;
          let nextEnd: string | null = null;

          // Search up to 14 days ahead for a free slot on a working day
          for (let i = 1; i <= 14; i++) {
            const candidate = new Date(Date.UTC(apptYear, apptMonth, apptDay + i));
            const candidateDayName = DAY_NAMES[candidate.getUTCDay()];

            // Check vet works on this day
            if (vetSchedDoc) {
              if (!vetSchedDoc.workingDays.includes(candidateDayName)) continue;
            } else if (branchFallbackDoc) {
              if (branchFallbackDoc.operatingDays.length > 0 && !branchFallbackDoc.operatingDays.includes(candidateDayName)) continue;
            }

            // Generate all possible slots for this day
            const candidateSlots = generateTimeSlots(schedSlotStart, schedSlotEnd, schedBreakStart, schedBreakEnd);

            // Get already-booked slots on this candidate day
            const candidateDayStart = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 0, 0, 0));
            const candidateDayEnd = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 23, 59, 59, 999));

            const bookedOnDay = await Appointment.find({
              vetId,
              date: { $gte: candidateDayStart, $lte: candidateDayEnd },
              status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] },
              _id: { $ne: appt._id }
            }).select('startTime');

            const bookedTimes = new Set(bookedOnDay.map((b: any) => b.startTime));
            const freeSlot = candidateSlots.find(s => !bookedTimes.has(s.startTime));

            if (freeSlot) {
              nextDate = candidate;
              nextStart = freeSlot.startTime;
              nextEnd = freeSlot.endTime;
              break;
            }
          }

          if (nextDate && nextStart && nextEnd) {
            appt.date = nextDate;
            appt.startTime = nextStart;
            appt.endTime = nextEnd;
            await appt.save();
            rescheduledAppointments.push(appt);
          }
        }

        // Notify the displaced appointment owner about the reschedule (fire-and-forget)
        Promise.all([
          User.findById(appt.ownerId).select('firstName email'),
          Pet.findById(appt.petId).select('name'),
          User.findById(appt.vetId).select('firstName lastName'),
          ClinicBranch.findById(appt.clinicBranchId).select('name'),
        ]).then(async ([apptOwner, apptPet, apptVet, apptBranch]) => {
          if (!apptOwner || !apptPet || !apptVet || !apptBranch) return;
          const newDateStr = (appt.date as Date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          await createNotification(
            appt.ownerId.toString(),
            'appointment_rescheduled',
            'Appointment Rescheduled',
            `Your appointment for ${(apptPet as any).name} with Dr. ${(apptVet as any).firstName} ${(apptVet as any).lastName} at ${(apptBranch as any).name} has been rescheduled to ${newDateStr} at ${appt.startTime} due to an emergency patient.`,
            { appointmentId: appt._id }
          );
        }).catch((err) => {
          console.error('[Appointment] Reschedule notification error:', err);
        });
      }
    }

    const appointment = await Appointment.create({
      petId,
      ownerId,
      vetId,
      clinicId,
      clinicBranchId,
      mode,
      types,
      date: new Date(date),
      startTime,
      endTime,
      notes: notes || null,
      isWalkIn: isEmergency ? true : isWalkIn === true,
      isEmergency: isEmergency === true,
      status: 'confirmed' // Clinic admin appointments are auto-confirmed
    });

    // Fetch related data for email + notification (fire-and-forget)
    Promise.all([
      User.findById(ownerId).select('firstName email'),
      User.findById(vetId).select('firstName lastName'),
      ClinicBranch.findById(clinicBranchId).select('name'),
    ]).then(async ([owner, vet, branch]) => {
      const dateStr = appointment.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const vetName = vet ? `Dr. ${vet.firstName} ${vet.lastName}` : 'your vet';
      const clinicName = branch?.name ?? 'the clinic';

      await createNotification(
        ownerId,
        'appointment_scheduled',
        'New Appointment Scheduled',
        `An appointment for ${pet.name} with ${vetName} at ${clinicName} on ${dateStr} at ${appointment.startTime} has been scheduled.`,
        { appointmentId: appointment._id }
      );

      if (owner?.email && vet && branch) {
        sendAppointmentBooked({
          ownerEmail: owner.email,
          ownerFirstName: owner.firstName,
          petName: pet.name,
          vetName: `${vet.firstName} ${vet.lastName}`,
          clinicName: branch.name,
          date: appointment.date,
          startTime: appointment.startTime,
          types: appointment.types,
          mode: appointment.mode,
        });
      }
    }).catch((err) => {
      console.error('[Appointment] Clinic post-create notification/email error:', err);
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Appointment booked successfully',
      data: { appointment, rescheduledAppointments }
    });
  } catch (error: any) {
    console.error('Create clinic appointment error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while booking the appointment' });
  }
};

/**
 * Get all appointments for the clinic admin's clinic (for calendar view)
 */
export const getClinicAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    // Resolve clinic — mirrors getClinicForAdmin in clinicController for consistency
    let clinic;
    if (req.user.clinicId) {
      clinic = await Clinic.findOne({ _id: req.user.clinicId, isActive: true });
    }
    if (!clinic && req.user.clinicBranchId) {
      const branch = await ClinicBranch.findById(req.user.clinicBranchId).select('clinicId');
      if (branch?.clinicId) {
        clinic = await Clinic.findOne({ _id: branch.clinicId, isActive: true });
      }
    }
    // Stale-JWT fallback: look up from the User document directly
    if (!clinic) {
      const dbUser = await User.findById(req.user.userId).select('clinicId clinicBranchId');
      if (dbUser?.clinicId) {
        clinic = await Clinic.findOne({ _id: dbUser.clinicId, isActive: true });
      } else if (dbUser?.clinicBranchId) {
        const branch = await ClinicBranch.findById(dbUser.clinicBranchId).select('clinicId');
        if (branch?.clinicId) {
          clinic = await Clinic.findOne({ _id: branch.clinicId, isActive: true });
        }
      }
    }
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { date, branchId, filter } = req.query;
    const query: any = { clinicId: clinic._id };

    // Branch filtering:
    // - non-main admins: always restrict to their assigned branch
    // - main admins: see all branches unless a specific branchId is passed as a query param
    if (req.user.clinicBranchId && !req.user.isMainBranch) {
      query.clinicBranchId = req.user.clinicBranchId;
    } else if (branchId) {
      query.clinicBranchId = branchId;
    }

    if (date) {
      // Use date range to avoid timezone exact-match issues
      const dayStart = new Date(date as string);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date as string);
      dayEnd.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: dayStart, $lte: dayEnd };
    }

    const now = new Date();
    if (filter === 'upcoming') {
      query.status = { $in: ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress'] };
      if (!date) {
        query.date = { $gte: new Date(now.toISOString().split('T')[0]) };
      }
    } else if (filter === 'previous') {
      query.$or = [
        { date: { $lt: new Date(now.toISOString().split('T')[0]) } },
        { status: { $in: ['completed', 'cancelled'] } }
      ];
    } else if (date) {
      // No filter specified but a specific date was requested — exclude cancelled
      query.status = { $nin: ['cancelled'] };
    }

    const staleConfirmedQuery: any = {
      clinicId: clinic._id,
      status: 'confirmed',
    };
    if (query.clinicBranchId) staleConfirmedQuery.clinicBranchId = query.clinicBranchId;

    const staleConfirmedAppointments = await Appointment.find(staleConfirmedQuery)
      .select('_id date startTime')
      .lean();

    const nowLocal = new Date();
    const staleAppointmentIds: string[] = [];
    for (const appointment of staleConfirmedAppointments as any[]) {
      if (!appointment?.date || !appointment?.startTime) continue;
      const startDateTime = getAppointmentStartDateTime(new Date(appointment.date), appointment.startTime);
      if (!startDateTime) continue;
      const cancelThreshold = new Date(startDateTime.getTime() + 15 * 60 * 1000);
      if (cancelThreshold < nowLocal) {
        staleAppointmentIds.push(String(appointment._id));
      }
    }

    if (staleAppointmentIds.length > 0) {
      await Appointment.updateMany(
        { _id: { $in: staleAppointmentIds }, status: 'confirmed' },
        { $set: { status: 'cancelled' } }
      );
    }

    const appointments = await Appointment.find(query)
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email isGuest claimStatus claimInviteSentAt')
      .populate('vetId', 'firstName lastName email')
      .populate('clinicBranchId', 'name address')
      .sort({ date: 1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get clinic appointments error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching appointments' });
  }
};

/**
 * Get the next upcoming appointment for a pet
 */
export const getNextAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId } = req.params;

    // Verify pet exists and belongs to the user
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }

    if (pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this pet\'s appointments' });
    }

    // Get the next upcoming appointment (not completed, not cancelled)
    const now = new Date();
    const appointment = await Appointment.findOne({
      petId: petId,
      date: { $gte: now },
      status: { $in: ['pending', 'confirmed', 'rescheduled'] }
    })
      .populate('clinicBranchId', 'name address')
      .populate('vetId', 'firstName lastName')
      .sort({ date: 1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointment }
    });
  } catch (error) {
    console.error('Get next appointment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the next appointment' });
  }
};

/**
 * GET /api/appointments/:id
 * Get a single appointment by ID (vet or clinic admin).
 */
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('petId', 'name species breed sex dateOfBirth photo ownerId')
      .populate('ownerId', 'firstName lastName email phone')
      .populate('vetId', 'firstName lastName email');

    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    // Access: vet on the appointment, clinic-admin, or the pet owner
    const isVet = appointment.vetId.toString() === req.user.userId;
    const isOwner = appointment.ownerId.toString() === req.user.userId;
    const isAdmin = req.user.userType === 'clinic-admin';

    if (!isVet && !isOwner && !isAdmin) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to view this appointment' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointment }
    });
  } catch (error) {
    console.error('Get appointment by ID error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching the appointment' });
  }
};
/**
 * Get clinic branches for the authenticated user
 * - Clinic admins: return only their assigned branch
 * - Veterinarians: return only branches they are assigned to
 * - Pet owners: return all branches in their clinic
 */
export const getClinicBranches = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let clinicId: string;
    let branchIds: string[] | undefined;

    if (req.user.userType === 'veterinarian') {
      // Veterinarians: get their assigned branches
      const vetApps = await VetApplication.find({ vetId: req.user.userId });
      if (!vetApps || vetApps.length === 0) {
        return res.status(403).json({ status: 'ERROR', message: 'Veterinarian has no clinic assignment' });
      }
      
      const branch = await ClinicBranch.findById(vetApps[0].branchId);
      if (!branch) {
        return res.status(403).json({ status: 'ERROR', message: 'Branch not found' });
      }
      clinicId = (branch.clinicId as any).toString();
      
      // Get all branches this vet is assigned to
      branchIds = vetApps.map(va => (va.branchId as any).toString());
    } else if (req.user.userType === 'clinic-admin') {
      // Clinic admins: return only their assigned branch
      const clinic = await getClinicForAdmin(req);
      if (!clinic) {
        return res.status(403).json({ status: 'ERROR', message: 'No clinic associated with user' });
      }
      clinicId = (clinic._id as any).toString();
      
      // Get the clinic admin's assigned branch(es)
      if (req.user.clinicBranchId) {
        branchIds = [(req.user.clinicBranchId as any).toString()];
      } else {
        // Fallback: fetch the main branch if no specific branch is assigned
        const mainBranch = await ClinicBranch.findOne({ clinicId, isMain: true });
        if (mainBranch) {
          branchIds = [(mainBranch._id as any).toString()];
        }
      }
    } else {
      // Pet owners: return all branches in their clinic (if they have one)
      // For now, we'll get the clinic from clinicId if it's stored in user record
      // or return all active branches if no specific clinic
      const clinic = await getClinicForAdmin(req);
      if (clinic) {
        clinicId = (clinic._id as any).toString();
      } else {
        // No clinic associated; return empty
        return res.status(200).json({
          status: 'SUCCESS',
          data: []
        });
      }
    }

    // Fetch branches; include inactive if requested.
    // ?allBranches=true bypasses the per-user assignment scope so all active
    // clinic branches are returned — used for cross-branch surgery scheduling.
    const includeInactive = req.query.all === 'true';
    const allBranches = req.query.allBranches === 'true';
    const branchFilter: any = { clinicId };
    if (branchIds && !allBranches) {
      branchFilter._id = { $in: branchIds };
    }
    if (!includeInactive) branchFilter.isActive = true;
    
    const branches = await ClinicBranch.find(branchFilter)
      .select('_id name isMain')
      .sort({ isMain: -1, name: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: branches
    });
  } catch (error) {
    console.error('Get clinic branches error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching clinic branches' });
  }
};

/**
 * Get assigned (approved) vets for a specific clinic branch
 */
export const getVetsByBranchId = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'branchId is required' });
    }

    // Verify branch exists
    const branch = await ClinicBranch.findOne({ _id: branchId });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Verify user has access to this branch's clinic
    let userClinicId: string;
    if (req.user.userType === 'veterinarian') {
      const vetApp = await VetApplication.findOne({ vetId: req.user.userId });
      if (!vetApp) {
        return res.status(403).json({ status: 'ERROR', message: 'No clinic assignment' });
      }
      const userBranch = await ClinicBranch.findById(vetApp.branchId);
      if (!userBranch) {
        return res.status(403).json({ status: 'ERROR', message: 'Branch not found' });
      }
      userClinicId = (userBranch.clinicId as any).toString();
    } else if (req.user.clinicId) {
      userClinicId = req.user.clinicId;
    } else {
      return res.status(403).json({ status: 'ERROR', message: 'No clinic associated with user' });
    }

    if ((branch.clinicId as any).toString() !== userClinicId) {
      return res.status(403).json({ status: 'ERROR', message: 'You do not have access to this branch' });
    }

    // Find active vet assignments for this branch
    const activeAssignments = await AssignedVet.find({
      clinicBranchId: branchId,
      isActive: true,
      petId: null,
    }).populate('vetId', 'firstName lastName email userType resignation');

    const vets = activeAssignments
      .filter((a) => a.vetId && (a.vetId as any).userType === 'veterinarian')
      .map((a) => {
        const vet = a.vetId as any;
        const unavailableAfter = getVetBookingCutoffDate(vet?.resignation || null);
        return {
          _id: vet._id,
          firstName: vet.firstName,
          lastName: vet.lastName,
          email: vet.email,
          resignationStatus: vet?.resignation?.status || null,
          resignationEndDate: vet?.resignation?.endDate || null,
          unavailableAfter,
        };
      });

    return res.status(200).json({
      status: 'SUCCESS',
      data: vets
    });
  } catch (error) {
    console.error('Get vets by branch error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vets' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GUEST INTAKE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** Placeholder email domain used for guests with no real email. */
const GUEST_EMAIL_DOMAIN = 'pawsync.gs';

function isGuestPlaceholderEmail(email: string): boolean {
  return email.endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/**
 * POST /api/appointments/clinic/guest-intake
 * Create a guest owner + pet + appointment in one transaction (clinic admin only).
 */
export const createGuestIntakeAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      // Owner fields
      ownerFirstName, ownerLastName, ownerEmail, ownerContact,
      // Pet fields
      petName, petSpecies, petBreed, petSex, petDateOfBirth, petWeight, petSterilization,
      // Appointment fields
      vetId, clinicBranchId, mode, types, date, startTime, endTime, notes, isWalkIn, isEmergency,
    } = req.body;

    // ── Validate required owner fields ────────────────────────────────────────
    if (!ownerFirstName || !ownerLastName) {
      return res.status(400).json({ status: 'ERROR', message: 'Owner first name and last name are required' });
    }

    // ── Validate required pet fields ──────────────────────────────────────────
    if (!petName || !petSpecies || !petBreed || !petSex || !petDateOfBirth || petWeight == null || !petSterilization) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet name, species, breed, sex, date of birth, weight, and sterilization are required' });
    }
    if (!['canine', 'feline'].includes(petSpecies)) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet species must be canine or feline' });
    }
    if (!['male', 'female'].includes(petSex)) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet sex must be male or female' });
    }
    if (!['spayed', 'unspayed', 'neutered', 'unneutered', 'unknown'].includes(petSterilization)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid sterilization status' });
    }

    // ── Resolve clinic for this admin ─────────────────────────────────────────
    let clinicId: string | null = null;
    if (req.user.clinicId) {
      clinicId = req.user.clinicId.toString();
    } else if (req.user.clinicBranchId) {
      const branch = await ClinicBranch.findById(req.user.clinicBranchId).select('clinicId');
      clinicId = branch?.clinicId?.toString() || null;
    }
    if (!clinicId) {
      const dbUser = await User.findById(req.user.userId).select('clinicId clinicBranchId');
      if (dbUser?.clinicId) {
        clinicId = dbUser.clinicId.toString();
      } else if (dbUser?.clinicBranchId) {
        const branch = await ClinicBranch.findById(dbUser.clinicBranchId).select('clinicId');
        clinicId = branch?.clinicId?.toString() || null;
      }
    }
    if (!clinicId) {
      return res.status(403).json({ status: 'ERROR', message: 'No clinic associated with this admin account' });
    }

    // ── Duplicate owner check ─────────────────────────────────────────────────
    // Normalise email and contact number the same way the schema + pre-save hook will.
    const trimmedEmail = ownerEmail ? String(ownerEmail).trim().toLowerCase() : '';
    if (trimmedEmail) {
      const existingUser = await User.findOne({ email: trimmedEmail });
      if (existingUser) {
        return res.status(409).json({
          status: 'ERROR',
          message: existingUser.isGuest
            ? 'A guest record with this email already exists. Please search for the existing owner.'
            : 'A pet owner account with this email already exists. Please search for them instead.',
          existingOwnerId: existingUser._id,
        });
      }
    }

    // Check contact-number uniqueness before creation so the client gets a
    // targeted message (not the generic 11000 handler which used to say "email").
    const normalizedContact = ownerContact ? String(ownerContact).trim().replace(/\D/g, '') : '';
    if (normalizedContact) {
      const existingByContact = await User.findOne({ contactNumberNormalized: normalizedContact });
      if (existingByContact) {
        return res.status(409).json({
          status: 'ERROR',
          message: existingByContact.isGuest
            ? 'A guest record with this contact number already exists. Please search for the existing owner.'
            : 'A pet owner account with this contact number already exists. Please use their existing account.',
          existingOwnerId: existingByContact._id,
        });
      }
    }

    // Soft duplicate check by name for same clinic (warn, not block — different pets possible)
    const nameConflict = await User.findOne({
      firstName: { $regex: new RegExp(`^${ownerFirstName.trim()}$`, 'i') },
      lastName: { $regex: new RegExp(`^${ownerLastName.trim()}$`, 'i') },
      isGuest: true,
      guestClinicId: clinicId,
    });

    // ── Validate appointment date/time ────────────────────────────────────────
    const appointmentDate = new Date(date);
    if (Number.isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment date' });
    }
    const appointmentStartDateTime = getAppointmentStartDateTime(appointmentDate, startTime);
    if (!appointmentStartDateTime) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid appointment start time' });
    }
    if (appointmentStartDateTime.getTime() < Date.now()) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot book an appointment in the past' });
    }

    // ── Validate appointment types / mode ────────────────────────────────────
    if (!Array.isArray(types) || types.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'At least one appointment type is required' });
    }
    if (mode === 'online') {
      return res.status(400).json({ status: 'ERROR', message: 'Guest walk-in/emergency appointments must be face-to-face' });
    }
    const hasGuestGrooming = types.some((t: string) => t === 'basic-grooming' || t === 'full-grooming');
    const hasGuestMedical = types.some((t: string) => t !== 'basic-grooming' && t !== 'full-grooming');
    if (hasGuestGrooming && hasGuestMedical) {
      return res.status(400).json({ status: 'ERROR', message: 'Grooming services cannot be combined with medical services' });
    }
    if (hasGuestMedical && !vetId) {
      return res.status(400).json({ status: 'ERROR', message: 'A veterinarian must be selected for medical appointments' });
    }
    if (hasGuestMedical && vetId) {
      const vet = await User.findById(vetId).select('userType resignation');
      if (!vet || vet.userType !== 'veterinarian') {
        return res.status(400).json({ status: 'ERROR', message: 'Selected veterinarian is not available' });
      }
      const cutoff = getVetBookingCutoffDate(vet.resignation as any);
      if (cutoff && new Date(date) > cutoff) {
        return res.status(400).json({ status: 'ERROR', message: `Vet unavailable after ${cutoff.toLocaleDateString('en-US')}` });
      }
    }

    // ── Slot availability (skip for emergency) ────────────────────────────────
    if (!isEmergency) {
      if (hasGuestMedical && vetId) {
        const slotTaken = await Appointment.findOne({
          vetId,
          date: new Date(date),
          startTime,
          status: { $in: ['pending', 'confirmed', 'rescheduled'] },
        });
        if (slotTaken) {
          return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
        }
      }
    }

    // ── Create guest owner ────────────────────────────────────────────────────
    const hasRealEmail = !!trimmedEmail;
    const placeholderEmail = hasRealEmail
      ? trimmedEmail
      : `__guest_${crypto.randomBytes(8).toString('hex')}@${GUEST_EMAIL_DOMAIN}`;

    const guestOwner = (await User.create({
      email: placeholderEmail,
      firstName: ownerFirstName.trim(),
      lastName: ownerLastName.trim(),
      contactNumber: ownerContact ? String(ownerContact).trim() : (null as any),
      userType: 'pet-owner' as const,
      isGuest: true,
      claimStatus: hasRealEmail ? 'unclaimed' : 'unclaimable',
      guestClinicId: clinicId,
      emailVerified: false,
      isVerified: false,
    } as any)) as any;

    // ── Create guest pet ──────────────────────────────────────────────────────
    const guestPet = (await Pet.create({
      ownerId: guestOwner._id,
      name: petName.trim(),
      species: petSpecies,
      breed: petBreed.trim(),
      sex: petSex,
      dateOfBirth: new Date(petDateOfBirth),
      weight: Number(petWeight),
      sterilization: petSterilization,
      status: 'alive',
      isAlive: true,
    } as any)) as any;

    // ── Emergency cascade (same logic as createClinicAppointment) ────────────
    let rescheduledAppointments: any[] = [];
    if (isEmergency && vetId) {
      let schedSlotStart = '07:00';
      let schedSlotEnd = '17:00';
      let schedBreakStart: string | null = null;
      let schedBreakEnd: string | null = null;
      let vetSchedDoc: any = null;
      let branchFallbackDoc: any = null;

      const vetSched = await VetSchedule.findOne({ vetId, branchId: clinicBranchId });
      if (vetSched) {
        vetSchedDoc = vetSched;
        schedSlotStart = vetSched.startTime;
        schedSlotEnd = vetSched.endTime;
        schedBreakStart = vetSched.breakStart ?? null;
        schedBreakEnd = vetSched.breakEnd ?? null;
      } else {
        const branch = await ClinicBranch.findById(clinicBranchId);
        branchFallbackDoc = branch;
        if (branch?.openingTime) schedSlotStart = branch.openingTime;
        if (branch?.closingTime) schedSlotEnd = branch.closingTime;
      }

      const emergencyDayStart = new Date(date); emergencyDayStart.setUTCHours(0, 0, 0, 0);
      const emergencyDayEnd = new Date(date); emergencyDayEnd.setUTCHours(23, 59, 59, 999);
      const sameDay = await Appointment.find({
        vetId,
        date: { $gte: emergencyDayStart, $lte: emergencyDayEnd },
        startTime: { $gte: startTime },
        status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] },
      }).sort({ startTime: 1 });

      let pushTo = endTime;
      for (const appt of sameDay) {
        if (appt.startTime >= pushTo) break;
        const newStart = pushTo;
        const newEnd = addMinutes(pushTo, 30);
        if (newEnd <= schedSlotEnd) {
          appt.startTime = newStart;
          appt.endTime = newEnd;
          await appt.save();
          pushTo = newEnd;
          rescheduledAppointments.push(appt);
        } else {
          const apptYear = (appt.date as Date).getUTCFullYear();
          const apptMonth = (appt.date as Date).getUTCMonth();
          const apptDay = (appt.date as Date).getUTCDate();
          let nextDate: Date | null = null;
          let nextStart: string | null = null;
          let nextEnd: string | null = null;
          for (let i = 1; i <= 14; i++) {
            const candidate = new Date(Date.UTC(apptYear, apptMonth, apptDay + i));
            const candidateDayName = DAY_NAMES[candidate.getUTCDay()];
            if (vetSchedDoc) {
              if (!vetSchedDoc.workingDays.includes(candidateDayName)) continue;
            } else if (branchFallbackDoc) {
              if (branchFallbackDoc.operatingDays.length > 0 && !branchFallbackDoc.operatingDays.includes(candidateDayName)) continue;
            }
            const candidateSlots = generateTimeSlots(schedSlotStart, schedSlotEnd, schedBreakStart, schedBreakEnd);
            const candidateDayStart = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 0, 0, 0));
            const candidateDayEnd = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 23, 59, 59, 999));
            const bookedOnDay = await Appointment.find({
              vetId,
              date: { $gte: candidateDayStart, $lte: candidateDayEnd },
              status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_progress'] },
              _id: { $ne: appt._id },
            }).select('startTime');
            const bookedTimes = new Set(bookedOnDay.map((b: any) => b.startTime));
            const freeSlot = candidateSlots.find(s => !bookedTimes.has(s.startTime));
            if (freeSlot) { nextDate = candidate; nextStart = freeSlot.startTime; nextEnd = freeSlot.endTime; break; }
          }
          if (nextDate && nextStart && nextEnd) {
            appt.date = nextDate; appt.startTime = nextStart; appt.endTime = nextEnd;
            await appt.save();
            rescheduledAppointments.push(appt);
          }
        }
      }
    }

    // ── Create appointment ────────────────────────────────────────────────────
    const resolvedVetId = hasGuestGrooming && !hasGuestMedical ? null : vetId || null;
    const appointment = await Appointment.create({
      petId: guestPet._id,
      ownerId: guestOwner._id,
      vetId: resolvedVetId,
      clinicId,
      clinicBranchId,
      mode: mode || 'face-to-face',
      types,
      date: new Date(date),
      startTime,
      endTime,
      notes: notes || null,
      isWalkIn: isEmergency ? true : isWalkIn === true,
      isEmergency: isEmergency === true,
      status: 'confirmed',
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    await AuditTrail.create({
      action: 'guest_intake_created',
      actorUserId: req.user.userId,
      targetUserId: guestOwner._id,
      clinicId,
      clinicBranchId,
      metadata: {
        appointmentId: appointment._id,
        petId: guestPet._id,
        guestOwnerName: `${guestOwner.firstName} ${guestOwner.lastName}`,
        petName: guestPet.name,
        claimStatus: guestOwner.claimStatus,
        hasRealEmail,
        isWalkIn: appointment.isWalkIn,
        isEmergency: appointment.isEmergency,
        nameDuplicateWarning: nameConflict ? nameConflict._id.toString() : null,
      },
    });

    // ── Auto-send claim invite if a real email was provided ───────────────────
    // Non-blocking: a failure here never rolls back the appointment creation.
    let inviteSent = false;
    if (hasRealEmail) {
      try {
        const claimToken = crypto.randomBytes(32).toString('hex');
        const claimTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(guestOwner._id, {
          claimToken,
          claimTokenExpires,
          claimStatus: 'invited',
          claimInviteSentAt: new Date(),
        });

        let clinicName = 'the clinic';
        const clinicDoc = await Clinic.findById(clinicId).select('name');
        if (clinicDoc) clinicName = clinicDoc.name;

        await sendGuestClaimInviteEmail({
          ownerEmail: guestOwner.email,
          ownerFirstName: guestOwner.firstName,
          clinicName,
          claimToken,
        });

        await AuditTrail.create({
          action: 'guest_claim_invite_sent',
          actorUserId: req.user.userId,
          targetUserId: guestOwner._id,
          clinicId,
          clinicBranchId,
          metadata: {
            ownerName: `${guestOwner.firstName} ${guestOwner.lastName}`,
            email: guestOwner.email,
            expiresAt: claimTokenExpires,
            autoSentOnCreation: true,
          },
        });

        inviteSent = true;
      } catch (emailErr) {
        console.error('[Guest intake] Auto-invite email failed (non-blocking):', emailErr);
      }
    }

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Guest intake appointment created successfully',
      data: {
        appointment,
        guestOwner: {
          _id: guestOwner._id,
          firstName: guestOwner.firstName,
          lastName: guestOwner.lastName,
          email: hasRealEmail ? guestOwner.email : null,
          contactNumber: guestOwner.contactNumber,
          isGuest: true,
          claimStatus: inviteSent ? 'invited' : guestOwner.claimStatus,
        },
        guestPet: {
          _id: guestPet._id,
          name: guestPet.name,
          species: guestPet.species,
          breed: guestPet.breed,
          sex: guestPet.sex,
        },
        rescheduledAppointments,
        nameDuplicateWarning: nameConflict
          ? `A guest named "${nameConflict.firstName} ${nameConflict.lastName}" already exists at this clinic. Please confirm this is a different person.`
          : null,
        inviteSent,
      },
    });
  } catch (error: any) {
    console.error('Create guest intake error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      // Identify which unique field caused the violation so the message is accurate.
      const conflictField = Object.keys(error.keyPattern || {})[0] || '';
      if (conflictField.includes('contactNumber')) {
        return res.status(409).json({ status: 'ERROR', message: 'A user with this contact number already exists' });
      }
      return res.status(409).json({ status: 'ERROR', message: 'A user with this email already exists' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the guest intake' });
  }
};

/**
 * POST /api/appointments/clinic/guest/:ownerId/send-claim-invite
 * Send a claim invite email to a guest owner (clinic admin only).
 */
export const sendGuestClaimInvite = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId } = req.params;
    const guestOwner = await User.findById(ownerId).select('+claimToken +claimTokenExpires');
    if (!guestOwner || !guestOwner.isGuest) {
      return res.status(404).json({ status: 'ERROR', message: 'Guest owner not found' });
    }

    // Require real email before sending invite
    if (!guestOwner.email || isGuestPlaceholderEmail(guestOwner.email)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Cannot send claim invite — no email address on file. Please add an email first.',
        claimStatus: 'unclaimable',
      });
    }

    if (guestOwner.claimStatus === 'claimed') {
      return res.status(400).json({ status: 'ERROR', message: 'This guest account has already been claimed' });
    }

    // Generate claim token (expires in 7 days)
    const claimToken = crypto.randomBytes(32).toString('hex');
    const claimTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    guestOwner.claimToken = claimToken;
    guestOwner.claimTokenExpires = claimTokenExpires;
    guestOwner.claimStatus = 'invited';
    guestOwner.claimInviteSentAt = new Date();
    await guestOwner.save();

    // Resolve clinic name for the email
    let clinicName = 'the clinic';
    if (guestOwner.guestClinicId) {
      const clinic = await Clinic.findById(guestOwner.guestClinicId).select('name');
      if (clinic) clinicName = clinic.name;
    }

    await sendGuestClaimInviteEmail({
      ownerEmail: guestOwner.email,
      ownerFirstName: guestOwner.firstName,
      clinicName,
      claimToken,
    });

    // Audit log
    await AuditTrail.create({
      action: 'guest_claim_invite_sent',
      actorUserId: req.user.userId,
      targetUserId: guestOwner._id,
      clinicId: guestOwner.guestClinicId || null,
      clinicBranchId: null,
      metadata: {
        ownerName: `${guestOwner.firstName} ${guestOwner.lastName}`,
        email: guestOwner.email,
        expiresAt: claimTokenExpires,
      },
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Claim invite sent to ${guestOwner.email}`,
      data: { claimStatus: 'invited', claimInviteSentAt: guestOwner.claimInviteSentAt },
    });
  } catch (error) {
    console.error('Send guest claim invite error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while sending the claim invite' });
  }
};

/**
 * PATCH /api/appointments/clinic/guest/:ownerId/update-email
 * Update a guest owner's email address (and optionally trigger a claim invite).
 * Body: { email: string, sendInvite?: boolean }
 */
export const updateGuestEmail = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId } = req.params;
    const { email, sendInvite } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Email is required' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide a valid email address' });
    }

    const guestOwner = await User.findById(ownerId).select('+claimToken +claimTokenExpires');
    if (!guestOwner || !guestOwner.isGuest) {
      return res.status(404).json({ status: 'ERROR', message: 'Guest owner not found' });
    }

    if (guestOwner.claimStatus === 'claimed') {
      return res.status(400).json({ status: 'ERROR', message: 'This guest account has already been claimed' });
    }

    // Check email uniqueness against other users
    const conflict = await User.findOne({ email: trimmedEmail, _id: { $ne: guestOwner._id } });
    if (conflict) {
      return res.status(409).json({
        status: 'ERROR',
        message: conflict.isGuest
          ? 'Another guest already uses this email.'
          : 'A registered account already uses this email. The pet owner should log in and use the existing account.',
      });
    }

    const oldEmail = guestOwner.email;
    guestOwner.email = trimmedEmail;
    if (guestOwner.claimStatus === 'unclaimable') {
      guestOwner.claimStatus = 'unclaimed';
    }
    await guestOwner.save();

    // Audit log
    await AuditTrail.create({
      action: 'guest_email_updated',
      actorUserId: req.user.userId,
      targetUserId: guestOwner._id,
      clinicId: guestOwner.guestClinicId || null,
      clinicBranchId: null,
      metadata: { oldEmail, newEmail: trimmedEmail, ownerName: `${guestOwner.firstName} ${guestOwner.lastName}` },
    });

    // Optionally send claim invite immediately
    if (sendInvite) {
      const claimToken = crypto.randomBytes(32).toString('hex');
      const claimTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      guestOwner.claimToken = claimToken;
      guestOwner.claimTokenExpires = claimTokenExpires;
      guestOwner.claimStatus = 'invited';
      guestOwner.claimInviteSentAt = new Date();
      await guestOwner.save();

      let clinicName = 'the clinic';
      if (guestOwner.guestClinicId) {
        const clinic = await Clinic.findById(guestOwner.guestClinicId).select('name');
        if (clinic) clinicName = clinic.name;
      }

      await sendGuestClaimInviteEmail({
        ownerEmail: trimmedEmail,
        ownerFirstName: guestOwner.firstName,
        clinicName,
        claimToken,
      });

      await AuditTrail.create({
        action: 'guest_claim_invite_sent',
        actorUserId: req.user.userId,
        targetUserId: guestOwner._id,
        clinicId: guestOwner.guestClinicId || null,
        clinicBranchId: null,
        metadata: { email: trimmedEmail, expiresAt: claimTokenExpires },
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: sendInvite ? `Email updated and claim invite sent to ${trimmedEmail}` : `Email updated to ${trimmedEmail}`,
      data: {
        claimStatus: guestOwner.claimStatus,
        email: trimmedEmail,
        claimInviteSentAt: guestOwner.claimInviteSentAt,
      },
    });
  } catch (error: any) {
    console.error('Update guest email error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'This email is already in use' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the guest email' });
  }
};