import VaccineType from '../models/VaccineType';
import User from '../models/User';
import { alertClinicAdmins } from './clinicAdminAlertService';
import { sendVaccineBatchExpiryAlertEmail } from './emailService';
import { createNotification } from './notificationService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reviews every active vaccine type with a tracked batch expiration date,
 * deactivates batches that have expired, and notifies (in-app + email) every
 * vet in the owning branch and the clinic admin(s) at the 7/3/1-day-before and
 * expired thresholds. Each threshold fires exactly once per batch via
 * `expiryAlertFlags`, which reset whenever the batch number/expiration date changes.
 *
 * Shared by the nightly scheduler and the vaccine-type catalog endpoint, so an
 * expired batch is deactivated — and its vets/admins notified — the moment it's
 * discovered, not just at the next midnight run.
 */
export async function checkVaccineBatchExpiriesAndNotify(): Promise<void> {
  const now = new Date();
  const vaccineTypes = await VaccineType.find({
    defaultBatchExpirationDate: { $ne: null },
    isActive: true,
  });

  for (const vt of vaccineTypes) {
    if (!vt.defaultBatchExpirationDate) continue;
    const daysLeft = Math.floor((vt.defaultBatchExpirationDate.getTime() - now.getTime()) / ONE_DAY_MS);

    let alertStatus: 'expired' | 'expiring_soon' | null = null;
    let daysRemaining: number | undefined;
    let flagToSet: 'sevenDay' | 'threeDay' | 'oneDay' | 'expired' | null = null;

    if (daysLeft < 0 && !vt.expiryAlertFlags?.expired) {
      alertStatus = 'expired';
      flagToSet = 'expired';
    } else if (daysLeft <= 1 && daysLeft >= 0 && !vt.expiryAlertFlags?.oneDay) {
      alertStatus = 'expiring_soon';
      daysRemaining = 1;
      flagToSet = 'oneDay';
    } else if (daysLeft <= 3 && !vt.expiryAlertFlags?.threeDay) {
      alertStatus = 'expiring_soon';
      daysRemaining = 3;
      flagToSet = 'threeDay';
    } else if (daysLeft <= 7 && !vt.expiryAlertFlags?.sevenDay) {
      alertStatus = 'expiring_soon';
      daysRemaining = 7;
      flagToSet = 'sevenDay';
    }

    if (!alertStatus || !flagToSet) continue;

    const expiryDateLabel = vt.defaultBatchExpirationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const notifMetadata = {
      vaccineTypeId: vt._id,
      vaccineName: vt.name,
      batchNumber: vt.defaultBatchNumber || null,
      expirationDate: vt.defaultBatchExpirationDate,
    };
    const notifTitle = alertStatus === 'expired' ? 'Vaccine Batch Expired — Marked Inactive' : 'Vaccine Batch Expiring Soon';
    const notifMessage = alertStatus === 'expired'
      ? `${vt.name} (Batch/Lot ${vt.defaultBatchNumber || 'N/A'}) expired on ${expiryDateLabel} and was automatically marked inactive. Update the batch/lot number and expiration date to reactivate it.`
      : `${vt.name}'s current batch (Lot ${vt.defaultBatchNumber || 'N/A'}) expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${expiryDateLabel}).`;
    const notifType = alertStatus === 'expired' ? 'vaccine_batch_expired' : 'vaccine_batch_expiring_soon';

    // Notify + email every vet in the owning branch
    if (vt.clinicBranchId) {
      const vets = await User.find({ userType: 'veterinarian', clinicBranchId: vt.clinicBranchId })
        .select('_id firstName email')
        .lean();
      for (const v of vets) {
        await createNotification(
          (v as any)._id.toString(),
          notifType,
          notifTitle,
          notifMessage,
          notifMetadata
        );
        if ((v as any).email) {
          await sendVaccineBatchExpiryAlertEmail({
            recipientEmail: (v as any).email,
            recipientFirstName: (v as any).firstName || 'Doctor',
            vaccineName: vt.name,
            batchNumber: vt.defaultBatchNumber || '',
            expirationDate: vt.defaultBatchExpirationDate,
            status: alertStatus,
            daysRemaining,
          });
        }
      }
    }

    if (vt.clinicId) {
      await alertClinicAdmins({
        clinicId: vt.clinicId,
        clinicBranchId: vt.clinicBranchId,
        notificationType: notifType,
        notificationTitle: notifTitle,
        notificationMessage: notifMessage,
        metadata: notifMetadata,
        emailSubject: alertStatus === 'expired'
          ? `PawSync – Vaccine Batch Expired: ${vt.name}`
          : `PawSync – Vaccine Batch Expiring in ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}: ${vt.name}`,
        emailHeadline: alertStatus === 'expired' ? 'Vaccine Batch Expired' : 'Vaccine Batch Expiring Soon',
        emailIntro: alertStatus === 'expired'
          ? `The current batch of ${vt.name} has expired and has been marked unusable until the batch/lot information is updated.`
          : `The current batch of ${vt.name} will expire in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Please plan to restock soon.`,
        emailDetails: {
          'Vaccine': vt.name,
          'Batch / Lot No.': vt.defaultBatchNumber || '—',
          'Expiration Date': expiryDateLabel,
          'Status': alertStatus === 'expired' ? 'Expired — marked inactive' : `Expiring in ${daysRemaining} day(s)`,
        },
      });
    }

    vt.expiryAlertFlags = { ...vt.expiryAlertFlags, [flagToSet]: true } as any;
    if (alertStatus === 'expired') {
      vt.isActive = false;
    }
    await vt.save();
  }
}
