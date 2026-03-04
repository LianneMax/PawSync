import { Request, Response } from 'express';
import Notification from '../models/Notification';

/**
 * GET /api/notifications
 * Get notifications for the authenticated user (latest 50)
 */
export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ status: 'SUCCESS', data: { notifications } });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ status: 'ERROR', message: 'Notification not found' });
    }

    return res.status(200).json({ status: 'SUCCESS', data: { notification } });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({ status: 'SUCCESS', message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
