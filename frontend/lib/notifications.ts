import { authenticatedFetch } from './auth';

export type NotificationType =
  | 'appointment_scheduled'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_reminder'
  | 'appointment_rescheduled'
  | 'bill_due'
  | 'bill_paid'
  | 'vaccine_due'
  | 'pet_lost'
  | 'pet_found'
  | 'clinic_new_appointment_booked'
  | 'clinic_appointment_cancelled'
  | 'clinic_appointment_rescheduled'
  | 'clinic_vet_application_submitted'
  | 'clinic_pet_tag_requested'
  | 'clinic_invoice_paid'
  | 'confinement_release_request'
  | 'confinement_release_confirmed'
  | 'pregnancy_confirmed'
  | 'pregnancy_due_soon'
  | 'pregnancy_overdue'
  | 'clinic_qr_payment_submitted'
  | 'vet_resignation_submitted'
  | 'vet_resignation_approved'
  | 'vet_resignation_rejected'
  | 'vet_resigned'
  | 'clinic_vet_resignation_review'
  | 'appointment_reassigned'
  | 'medical_record_shared';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  isRead?: boolean;
  category?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export async function getMyNotifications(): Promise<Notification[]> {
  const data = await authenticatedFetch('/notifications');
  if (data?.status !== 'SUCCESS') throw new Error('Failed to fetch notifications');
  return data.data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await authenticatedFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await authenticatedFetch('/notifications/read-all', { method: 'PATCH' });
}
