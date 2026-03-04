import Notification, { NotificationType } from '../models/Notification';
import mongoose from 'mongoose';

export async function createNotification(
  userId: string | mongoose.Types.ObjectId,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await Notification.create({ userId, type, title, message, metadata });
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err);
  }
}
