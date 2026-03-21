import mongoose from 'mongoose';
import User from '../models/User';
import { NotificationType } from '../models/Notification';
import { createNotification } from './notificationService';
import { sendClinicAdminAlertEmail } from './emailService';

interface AlertClinicAdminsParams {
  clinicId: string | mongoose.Types.ObjectId;
  clinicBranchId?: string | mongoose.Types.ObjectId | null;
  notificationType: NotificationType;
  notificationTitle: string;
  notificationMessage: string;
  metadata?: Record<string, any>;
  emailSubject: string;
  emailHeadline: string;
  emailIntro: string;
  emailDetails?: Record<string, string | number | null | undefined>;
}

export async function alertClinicAdmins(params: AlertClinicAdminsParams): Promise<void> {
  try {
    const baseFilter: any = {
      userType: 'clinic-admin',
      clinicId: params.clinicId,
    };

    let admins = await User.find(
      params.clinicBranchId
        ? {
            ...baseFilter,
            $or: [
              { clinicBranchId: params.clinicBranchId },
              { isMainBranch: true },
            ],
          }
        : baseFilter
    )
      .select('_id firstName email')
      .lean();

    console.log(`[ClinicAdminAlert] Found ${admins.length} admin(s) for clinicId=${params.clinicId} branchId=${params.clinicBranchId ?? 'none'}`);
    if (admins.length === 0 && params.clinicBranchId) {
      admins = await User.find(baseFilter).select('_id firstName email').lean();
      console.log(`[ClinicAdminAlert] Fallback found ${admins.length} admin(s)`);
    }

    await Promise.all(
      admins.map(async (admin) => {
        const adminId = (admin as any)._id?.toString();
        if (!adminId) return;

        await createNotification(
          adminId,
          params.notificationType,
          params.notificationTitle,
          params.notificationMessage,
          params.metadata
        );

        if ((admin as any).email) {
          await sendClinicAdminAlertEmail({
            adminEmail: (admin as any).email,
            adminFirstName: (admin as any).firstName || 'Admin',
            subject: params.emailSubject,
            headline: params.emailHeadline,
            intro: params.emailIntro,
            details: params.emailDetails,
          });
        }
      })
    );
  } catch (error) {
    console.error('[ClinicAdminAlert] Failed to notify clinic admins:', error);
  }
}
