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
  | 'pet_lost';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
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
