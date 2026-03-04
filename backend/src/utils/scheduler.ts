import cron from 'node-cron';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import {
  sendAppointmentReminder,
  sendVaccinationDueReminder,
} from '../services/emailService';
import { createNotification } from '../services/notificationService';

export function startScheduler() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Running daily tasks...');
    const now = new Date();

    // ── 1. Vaccination status refresh ────────────────────────────────────────
    try {
      const expiredResult = await Vaccination.updateMany(
        { status: 'active', expiryDate: { $lt: now } },
        { $set: { status: 'expired', isUpToDate: false } }
      );
      const overdueResult = await Vaccination.updateMany(
        {
          status: 'active',
          nextDueDate: { $lt: now },
          $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }],
        },
        { $set: { status: 'overdue', isUpToDate: false } }
      );
      console.log(`[Scheduler] Marked ${expiredResult.modifiedCount} expired, ${overdueResult.modifiedCount} overdue`);
    } catch (err) {
      console.error('[Scheduler] Vaccination status refresh error:', err);
    }

    // ── 2. Vaccination overdue email notifications ────────────────────────────
    try {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const overdueVaccinations = await Vaccination.find({
        status: 'overdue',
        nextDueDate: { $gte: yesterday, $lt: now },
      }).populate({
        path: 'petId',
        select: 'name ownerId',
        populate: { path: 'ownerId', select: 'firstName email' },
      });

      for (const vax of overdueVaccinations) {
        const pet = vax.petId as any;
        const owner = pet?.ownerId as any;
        if (owner?.email && pet?.name && vax.nextDueDate) {
          await sendVaccinationDueReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet.name,
            vaccineName: vax.vaccineName,
            nextDueDate: vax.nextDueDate,
            type: 'overdue',
          });
          const dueDateStr = vax.nextDueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          await createNotification(
            owner._id.toString(),
            'vaccine_due',
            'Vaccination Overdue',
            `${pet.name}'s ${vax.vaccineName} vaccination was due on ${dueDateStr}. Please schedule an appointment soon.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
        }
      }
      console.log(`[Scheduler] Sent ${overdueVaccinations.length} overdue vaccination emails`);
    } catch (err) {
      console.error('[Scheduler] Vaccination overdue email error:', err);
    }

    // ── 3. Vaccination 7-day upcoming reminders ───────────────────────────────
    try {
      const in7Days = new Date(now);
      in7Days.setDate(in7Days.getDate() + 7);
      const in8Days = new Date(in7Days);
      in8Days.setDate(in8Days.getDate() + 1);

      const upcomingVaccinations = await Vaccination.find({
        status: 'active',
        nextDueDate: { $gte: in7Days, $lt: in8Days },
      }).populate({
        path: 'petId',
        select: 'name ownerId',
        populate: { path: 'ownerId', select: 'firstName email' },
      });

      for (const vax of upcomingVaccinations) {
        const pet = vax.petId as any;
        const owner = pet?.ownerId as any;
        if (owner?.email && pet?.name && vax.nextDueDate) {
          await sendVaccinationDueReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet.name,
            vaccineName: vax.vaccineName,
            nextDueDate: vax.nextDueDate,
            type: 'upcoming',
          });
          const dueDateStr = vax.nextDueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          await createNotification(
            owner._id.toString(),
            'vaccine_due',
            'Vaccination Reminder',
            `${pet.name}'s ${vax.vaccineName} vaccination is due on ${dueDateStr}. Schedule an appointment soon.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
        }
      }
      console.log(`[Scheduler] Sent ${upcomingVaccinations.length} upcoming vaccination reminder emails`);
    } catch (err) {
      console.error('[Scheduler] Vaccination upcoming reminder error:', err);
    }

    // ── 4. Appointment 24-hour reminders ─────────────────────────────────────
    try {
      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const tomorrowAppointments = await Appointment.find({
        date: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: { $in: ['pending', 'confirmed'] },
      })
        .populate('ownerId', 'firstName email')
        .populate('petId', 'name')
        .populate('vetId', 'firstName lastName')
        .populate('clinicBranchId', 'name');

      for (const appt of tomorrowAppointments) {
        const owner = appt.ownerId as any;
        const pet = appt.petId as any;
        const vet = appt.vetId as any;
        const branch = appt.clinicBranchId as any;
        const petName = pet?.name ?? 'your pet';
        const vetName = vet ? `Dr. ${vet.firstName} ${vet.lastName}` : 'your vet';
        const clinicName = branch?.name ?? 'the clinic';
        const dateStr = appt.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Always create in-app reminder
        if (owner?._id) {
          await createNotification(
            owner._id.toString(),
            'appointment_reminder',
            'Appointment Tomorrow',
            `Reminder: ${petName} has an appointment with ${vetName} at ${clinicName} tomorrow (${dateStr}) at ${appt.startTime}.`,
            { appointmentId: appt._id }
          );
        }

        if (owner?.email && vet && branch) {
          await sendAppointmentReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: petName,
            vetName: `${vet.firstName} ${vet.lastName}`,
            clinicName: branch.name,
            date: appt.date,
            startTime: appt.startTime,
            types: appt.types,
          });
        }
      }
      console.log(`[Scheduler] Sent ${tomorrowAppointments.length} appointment reminder emails`);
    } catch (err) {
      console.error('[Scheduler] Appointment reminder error:', err);
    }
  });

  // Run every minute to auto-cancel/complete appointments based on elapsed time
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Only consider appointments for today or earlier
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const activeAppointments = await Appointment.find({
        status: { $in: ['confirmed', 'in_progress'] },
        date: { $lte: todayStart },
      }).select('_id date startTime endTime status');

      const toCancel: string[] = [];
      const toComplete: string[] = [];

      for (const appt of activeAppointments) {
        const dateStr = appt.date.toISOString().split('T')[0];

        if (appt.status === 'confirmed') {
          // Auto-cancel if vet hasn't checked in within 15 minutes of start time
          const apptStart = new Date(`${dateStr}T${appt.startTime}`);
          const cancelThreshold = new Date(apptStart.getTime() + 15 * 60 * 1000);
          if (cancelThreshold < now) {
            toCancel.push(appt._id.toString());
          }
        } else if (appt.status === 'in_progress') {
          // Auto-complete if the appointment's end time has passed
          const apptEnd = new Date(`${dateStr}T${appt.endTime}`);
          if (apptEnd < now) {
            toComplete.push(appt._id.toString());
          }
        }
      }

      if (toCancel.length > 0) {
        await Appointment.updateMany(
          { _id: { $in: toCancel } },
          { $set: { status: 'cancelled' } }
        );
        console.log(`[Scheduler] Auto-cancelled ${toCancel.length} appointment(s) (no check-in within 15 min)`);
      }

      if (toComplete.length > 0) {
        await Appointment.updateMany(
          { _id: { $in: toComplete } },
          { $set: { status: 'completed' } }
        );
        console.log(`[Scheduler] Auto-completed ${toComplete.length} past appointment(s)`);
      }
    } catch (err) {
      console.error('[Scheduler] Auto-update appointments error:', err);
    }
  });

  console.log('[Scheduler] Daily tasks scheduled (midnight)');
}
