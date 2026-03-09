import { Request, Response } from 'express';
import PaymentQR from '../models/PaymentQR';

/**
 * GET /api/payment-qr
 * All authenticated users — list active QR codes.
 */
export const listPaymentQRs = async (req: Request, res: Response) => {
  try {
    const items = await PaymentQR.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ status: 'SUCCESS', data: { items } });
  } catch (error) {
    console.error('List payment QRs error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to fetch QR codes' });
  }
};

/**
 * POST /api/payment-qr
 * Clinic admin / branch admin only — upload a new payment QR code.
 */
export const createPaymentQR = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { label, imageData } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Label is required' });
    }
    if (!imageData) {
      return res.status(400).json({ status: 'ERROR', message: 'Image data is required' });
    }
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid image format' });
    }

    const clinicId = (req.user as any).clinicId || null;

    const item = await PaymentQR.create({
      label: label.trim(),
      imageData,
      clinicId,
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'QR code uploaded successfully',
      data: { item },
    });
  } catch (error) {
    console.error('Create payment QR error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to save QR code' });
  }
};

/**
 * DELETE /api/payment-qr/:id
 * Clinic admin / branch admin only — soft delete a QR code.
 */
export const deletePaymentQR = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const item = await PaymentQR.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'ERROR', message: 'QR code not found' });
    }

    item.isActive = false;
    await item.save();

    return res.status(200).json({ status: 'SUCCESS', message: 'QR code deleted successfully' });
  } catch (error) {
    console.error('Delete payment QR error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to delete QR code' });
  }
};
