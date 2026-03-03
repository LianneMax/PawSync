import cron from 'node-cron';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import {
  sendAppointmentReminder,
  sendVaccinationDueReminder,
} from '../services/emailService';

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
        if (owner?.email && vet && branch) {
          await sendAppointmentReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet?.name ?? '',
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

  console.log('[Scheduler] Daily tasks scheduled (midnight)');
}
