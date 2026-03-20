import cron from 'node-cron';
import Vaccination from '../models/Vaccination';
import Appointment from '../models/Appointment';
import Notification from '../models/Notification';
import User from '../models/User';
import ClinicBranch from '../models/ClinicBranch';
import Pet from '../models/Pet';
import Resignation from '../models/Resignation';
import AuditTrail from '../models/AuditTrail';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';
import {
  sendAppointmentReminder,
  sendAppointmentMissed,
  sendAppointmentCancelled,
  sendVaccinationDueReminder,
  sendVaccinationDueReminderVet,
} from '../services/emailService';
import { createNotification } from '../services/notificationService';
import { getPregnancySnapshot } from '../services/pregnancyDomainService';

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
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      const overdueVaccinations = await Vaccination.find({
        status: 'overdue',
        nextDueDate: { $gte: yesterday, $lt: now },
      })
        .populate({
          path: 'petId',
          select: 'name ownerId',
          populate: { path: 'ownerId', select: 'firstName lastName email' },
        })
        .populate('vetId', 'firstName lastName email');

      for (const vax of overdueVaccinations) {
        const pet = vax.petId as any;
        const owner = pet?.ownerId as any;
        const vet = vax.vetId as any;
        const dueDateStr = vax.nextDueDate!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        if (owner?.email && pet?.name && vax.nextDueDate) {
          await sendVaccinationDueReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet.name,
            vaccineName: vax.vaccineName,
            nextDueDate: vax.nextDueDate,
            type: 'overdue',
          });
          await createNotification(
            owner._id.toString(),
            'vaccine_due',
            'Vaccination Overdue',
            `${pet.name}'s ${vax.vaccineName} vaccination was due on ${dueDateStr}. Please schedule an appointment soon.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
        }

        // Notify the vet as well
        if (vet?._id && pet?.name && vax.nextDueDate) {
          await createNotification(
            vet._id.toString(),
            'vaccine_due',
            'Patient Vaccination Overdue',
            `${pet.name}'s ${vax.vaccineName} vaccination was due on ${dueDateStr} and has not been done.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
          if (vet.email && owner) {
            await sendVaccinationDueReminderVet({
              vetEmail: vet.email,
              vetFirstName: vet.firstName,
              petName: pet.name,
              ownerName: `${owner.firstName} ${owner.lastName}`,
              vaccineName: vax.vaccineName,
              nextDueDate: vax.nextDueDate,
              type: 'overdue',
            });
          }
        }
      }
      console.log(`[Scheduler] Sent ${overdueVaccinations.length} overdue vaccination emails`);
    } catch (err) {
      console.error('[Scheduler] Vaccination overdue email error:', err);
    }

    // ── 3. Vaccination 7-day upcoming reminders ───────────────────────────────
    try {
      const in7Days = new Date(now);
      in7Days.setUTCDate(in7Days.getUTCDate() + 7);
      const in8Days = new Date(in7Days);
      in8Days.setUTCDate(in8Days.getUTCDate() + 1);

      const upcomingVaccinations = await Vaccination.find({
        status: 'active',
        nextDueDate: { $gte: in7Days, $lt: in8Days },
      })
        .populate({
          path: 'petId',
          select: 'name ownerId',
          populate: { path: 'ownerId', select: 'firstName lastName email' },
        })
        .populate('vetId', 'firstName lastName email');

      for (const vax of upcomingVaccinations) {
        const pet = vax.petId as any;
        const owner = pet?.ownerId as any;
        const vet = vax.vetId as any;
        const dueDateStr = vax.nextDueDate!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        if (owner?.email && pet?.name && vax.nextDueDate) {
          await sendVaccinationDueReminder({
            ownerEmail: owner.email,
            ownerFirstName: owner.firstName,
            petName: pet.name,
            vaccineName: vax.vaccineName,
            nextDueDate: vax.nextDueDate,
            type: 'upcoming',
          });
          await createNotification(
            owner._id.toString(),
            'vaccine_due',
            'Vaccination Reminder',
            `${pet.name}'s ${vax.vaccineName} vaccination is due on ${dueDateStr}. Schedule an appointment soon.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
        }

        // Notify the vet as well
        if (vet?._id && pet?.name && vax.nextDueDate) {
          await createNotification(
            vet._id.toString(),
            'vaccine_due',
            'Patient Booster Due in 7 Days',
            `${pet.name}'s ${vax.vaccineName} booster is due on ${dueDateStr}. Follow up with the owner.`,
            { vaccinationId: vax._id, petId: pet._id }
          );
          if (vet.email && owner) {
            await sendVaccinationDueReminderVet({
              vetEmail: vet.email,
              vetFirstName: vet.firstName,
              petName: pet.name,
              ownerName: `${owner.firstName} ${owner.lastName}`,
              vaccineName: vax.vaccineName,
              nextDueDate: vax.nextDueDate,
              type: 'upcoming',
            });
          }
        }
      }
      console.log(`[Scheduler] Sent ${upcomingVaccinations.length} upcoming vaccination reminder emails`);
    } catch (err) {
      console.error('[Scheduler] Vaccination upcoming reminder error:', err);
    }

    // ── 4. Pregnancy overdue detection (3+ days past due) ────────────────────
    try {
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

      const pregnantPets = await Pet.find({ pregnancyStatus: 'pregnant', sex: 'female' })
        .populate('ownerId', '_id firstName email')
        .populate('assignedVetId', '_id firstName email')
        .lean();

      for (const pet of pregnantPets) {
        try {
          const snapshot = await getPregnancySnapshot(pet._id.toString());
          const dueDate = snapshot.activeEpisode?.expectedDueDate;
          if (!dueDate || dueDate >= threeDaysAgo) continue;

          const overdueDays = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000);
          const dueDateStr = new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const owner = (pet as any).ownerId;
          const vet = (pet as any).assignedVetId;

          if (owner?._id) {
            await createNotification(
              owner._id.toString(),
              'pregnancy_overdue',
              'Delivery Overdue',
              `${pet.name}'s expected delivery date was ${dueDateStr} (${overdueDays} days ago). Please contact your vet immediately.`,
              { petId: pet._id }
            );
          }
          if (vet?._id) {
            await createNotification(
              vet._id.toString(),
              'pregnancy_overdue',
              'Patient Delivery Overdue',
              `${pet.name}'s expected delivery date was ${dueDateStr} (${overdueDays} days ago). Follow up with the owner.`,
              { petId: pet._id }
            );
          }
        } catch (petErr) {
          console.error(`[Scheduler] Pregnancy overdue check failed for pet ${pet._id}:`, petErr);
        }
      }
      console.log(`[Scheduler] Checked ${pregnantPets.length} pregnant pet(s) for overdue delivery`);
    } catch (err) {
      console.error('[Scheduler] Pregnancy overdue detection error:', err);
    }

    // ── 5. Pregnancy due in 7 days ────────────────────────────────────────────
    try {
      const in7Days = new Date(now);
      in7Days.setUTCDate(in7Days.getUTCDate() + 7);
      const in8Days = new Date(in7Days);
      in8Days.setUTCDate(in8Days.getUTCDate() + 1);

      const pregnantPets7 = await Pet.find({ pregnancyStatus: 'pregnant', sex: 'female' })
        .populate('ownerId', '_id firstName email')
        .populate('assignedVetId', '_id firstName email')
        .lean();

      for (const pet of pregnantPets7) {
        try {
          const snapshot = await getPregnancySnapshot(pet._id.toString());
          const dueDate = snapshot.activeEpisode?.expectedDueDate;
          if (!dueDate) continue;
          const dueDateObj = new Date(dueDate);
          if (dueDateObj < in7Days || dueDateObj >= in8Days) continue;

          const dueDateStr = dueDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const owner = (pet as any).ownerId;
          const vet = (pet as any).assignedVetId;

          if (owner?._id) {
            await createNotification(
              owner._id.toString(),
              'pregnancy_due_soon',
              'Delivery Due in 7 Days',
              `${pet.name}'s expected delivery date is ${dueDateStr}. Please prepare and monitor for signs of labor.`,
              { petId: pet._id }
            );
          }
          if (vet?._id) {
            await createNotification(
              vet._id.toString(),
              'pregnancy_due_soon',
              'Patient Delivery Due in 7 Days',
              `${pet.name}'s expected delivery date is ${dueDateStr}. Consider scheduling a pre-delivery checkup.`,
              { petId: pet._id }
            );
          }
        } catch (petErr) {
          console.error(`[Scheduler] Pregnancy due-soon check failed for pet ${pet._id}:`, petErr);
        }
      }
      console.log(`[Scheduler] Checked ${pregnantPets7.length} pregnant pet(s) for upcoming delivery`);
    } catch (err) {
      console.error('[Scheduler] Pregnancy due-soon detection error:', err);
    }

    // ── 6. Purge expired unverified accounts ─────────────────────────────────
    try {
      const purgeResult = await User.deleteMany({
        emailVerified: false,
        emailVerificationExpires: { $lt: now },
      });
      if (purgeResult.deletedCount > 0) {
        console.log(`[Scheduler] Purged ${purgeResult.deletedCount} expired unverified account(s)`);
      }
    } catch (err) {
      console.error('[Scheduler] Unverified account purge error:', err);
    }

    // ── 7. Appointment 24-hour reminders ─────────────────────────────────────
    try {
      const tomorrowStart = new Date(now);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
      tomorrowStart.setUTCHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setUTCHours(23, 59, 59, 999);

      const tomorrowAppointments = await Appointment.find({
        date: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: { $in: ['pending', 'confirmed', 'rescheduled'] },
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
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Only consider appointments for today or earlier
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      const activeAppointments = await Appointment.find({
        status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress'] },
        date: { $lt: tomorrowStart },
      })
        .populate('ownerId', 'firstName lastName email')
        .populate('petId', 'name isLost status')
        .populate('vetId', 'firstName lastName')
        .populate('clinicBranchId', 'name');

      const upcomingAppointments = await Appointment.find({
        status: { $in: ['pending', 'confirmed', 'rescheduled', 'in_clinic'] },
        date: { $gte: todayStart },
      })
        .populate('ownerId', 'firstName lastName email')
        .populate('petId', 'name isLost status')
        .populate('vetId', 'firstName lastName')
        .populate('clinicBranchId', 'name');

      const toCancel: typeof activeAppointments = [];
      const lostPetToCancel: typeof activeAppointments = [];

      for (const appt of activeAppointments) {
        const dateStr = appt.date.toISOString().split('T')[0];
        const apptStart = new Date(`${dateStr}T${appt.startTime}`);
        const pet = appt.petId as any;

        if (pet?.isLost || pet?.status === 'lost') {
          if (apptStart <= now) {
            lostPetToCancel.push(appt);
          }
          continue;
        }

        if (appt.status === 'confirmed') {
          // Auto-cancel if vet hasn't checked in within 15 minutes of start time
          const cancelThreshold = new Date(apptStart.getTime() + 15 * 60 * 1000);
          if (cancelThreshold < now) {
            toCancel.push(appt);
          }
        }
      }

      for (const appt of upcomingAppointments) {
        const pet = appt.petId as any;
        const owner = appt.ownerId as any;
        if (!owner?._id || !(pet?.isLost || pet?.status === 'lost')) continue;

        const dateStr = appt.date.toISOString().split('T')[0];
        const apptStart = new Date(`${dateStr}T${appt.startTime}`);
        if (apptStart <= now || apptStart > next24Hours) continue;

        const reminderExists = await Notification.exists({
          userId: owner._id,
          type: 'appointment_reminder',
          'metadata.appointmentId': appt._id,
          'metadata.reason': 'pet_lost_upcoming',
        });

        if (!reminderExists) {
          await createNotification(
            owner._id.toString(),
            'appointment_reminder',
            'Upcoming Appointment While Pet Is Lost',
            `${pet?.name ?? 'Your pet'} is marked as lost and still has an upcoming appointment at ${appt.startTime}. Please mark your pet as found before the appointment time to avoid automatic cancellation.`,
            { appointmentId: appt._id, petId: pet?._id, reason: 'pet_lost_upcoming' }
          );
        }
      }

      if (toCancel.length > 0) {
        await Appointment.updateMany(
          { _id: { $in: toCancel.map(a => a._id) } },
          { $set: { status: 'cancelled' } }
        );
        console.log(`[Scheduler] Auto-cancelled ${toCancel.length} appointment(s) (no check-in within 15 min)`);

        // Send missed appointment email + in-app notification for each cancelled appointment
        for (const appt of toCancel) {
          const owner = appt.ownerId as any;
          const pet = appt.petId as any;
          const vet = appt.vetId as any;
          const branch = appt.clinicBranchId as any;
          const petName = pet?.name ?? 'your pet';
          const vetName = vet ? `${vet.firstName} ${vet.lastName}` : 'your vet';
          const clinicName = branch?.name ?? 'the clinic';
          const dateStr2 = appt.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          if (owner?._id) {
            await createNotification(
              owner._id.toString(),
              'appointment_cancelled',
              'Appointment Missed',
              `Your appointment for ${petName} on ${dateStr2} at ${appt.startTime} was not attended and has been cancelled. You can reschedule anytime.`,
              { appointmentId: appt._id }
            ).catch(() => {});
          }

          if (owner?.email && vet && branch) {
            await sendAppointmentMissed({
              ownerEmail: owner.email,
              ownerFirstName: owner.firstName,
              petName,
              vetName,
              clinicName,
              date: appt.date,
              startTime: appt.startTime,
              types: appt.types,
            }).catch(() => {});
          }
        }
      }

      if (lostPetToCancel.length > 0) {
        await Appointment.updateMany(
          { _id: { $in: lostPetToCancel.map(a => a._id) } },
          { $set: { status: 'cancelled' } }
        );
        console.log(`[Scheduler] Auto-cancelled ${lostPetToCancel.length} appointment(s) because pet is marked lost at appointment time`);

        for (const appt of lostPetToCancel) {
          const owner = appt.ownerId as any;
          const pet = appt.petId as any;
          const vet = appt.vetId as any;
          const dateStr = appt.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const petName = pet?.name ?? 'your pet';

          if (owner?._id) {
            await createNotification(
              owner._id.toString(),
              'appointment_cancelled',
              'Appointment Auto-cancelled (Pet Marked Lost)',
              `${petName}'s appointment on ${dateStr} at ${appt.startTime} was automatically cancelled because the pet is still marked as lost.`,
              { appointmentId: appt._id, petId: pet?._id, reason: 'pet_lost_at_appointment_time' }
            ).catch(() => {});
          }

          if (owner?.email && vet) {
            await sendAppointmentCancelled({
              ownerEmail: owner.email,
              ownerFirstName: owner.firstName,
              petName,
              vetName: `${vet.firstName} ${vet.lastName}`,
              date: appt.date,
              startTime: appt.startTime,
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Auto-update appointments error:', err);
    }
  });

  // Run every hour to deactivate vets whose notice period has ended
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const approvedResignations = await Resignation.find({
        status: 'approved',
        endDate: { $lte: now },
      })
        .populate('vetId', 'firstName lastName')
        .populate('backupVetId', 'firstName lastName')
        .populate('clinicBranchId', 'name');

      for (const resignation of approvedResignations) {
        await User.findByIdAndUpdate(resignation.vetId, {
          $set: {
            userType: 'inactive',
            'resignation.status': 'completed',
          },
        });

        resignation.status = 'completed';
        await resignation.save();

        const vet = resignation.vetId as any;
        const branch = resignation.clinicBranchId as any;
        const vetName = `Dr. ${vet?.firstName || ''} ${vet?.lastName || ''}`.trim();

        await alertClinicAdmins({
          clinicId: resignation.clinicId,
          clinicBranchId: resignation.clinicBranchId,
          notificationType: 'vet_resigned',
          notificationTitle: 'Veterinarian Resigned',
          notificationMessage: `${vetName} has been deactivated after completing notice period.`,
          metadata: { resignationId: resignation._id, vetId: resignation.vetId },
          emailSubject: 'PawSync – Veterinarian Resigned',
          emailHeadline: 'Veterinarian Resigned',
          emailIntro: `${vetName} has officially resigned.`,
          emailDetails: {
            Veterinarian: vetName,
            Branch: branch?.name || 'Clinic Branch',
            Status: 'Deactivated',
          },
        });

        await createNotification(
          resignation.vetId.toString(),
          'vet_resigned',
          'Resignation Completed',
          'Your account has been deactivated after the notice period ended.',
          { resignationId: resignation._id }
        );

        await createNotification(
          resignation.backupVetId.toString(),
          'vet_resigned',
          'Veterinarian Resigned',
          `${vetName} has officially resigned.`,
          { resignationId: resignation._id, vetId: resignation.vetId }
        );

        const ownerIds = await Appointment.distinct('ownerId', { vetId: resignation.vetId });
        for (const ownerId of ownerIds) {
          await createNotification(
            ownerId.toString(),
            'vet_resigned',
            'Veterinarian Resigned',
            `${vetName} has resigned from the clinic. Future appointments have been handled by the clinic team.`,
            { resignationId: resignation._id, vetId: resignation.vetId }
          );
        }

        await AuditTrail.create({
          action: 'vet_deactivated_after_resignation',
          actorUserId: null,
          targetUserId: resignation.vetId,
          clinicId: resignation.clinicId,
          clinicBranchId: resignation.clinicBranchId,
          metadata: {
            resignationId: resignation._id,
            endDate: resignation.endDate,
          },
        });
      }
    } catch (err) {
      console.error('[Scheduler] Resignation deactivation error:', err);
    }
  });

  console.log('[Scheduler] Daily tasks scheduled (midnight)');
}
