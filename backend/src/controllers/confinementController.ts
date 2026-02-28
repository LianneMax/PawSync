import { Request, Response } from 'express';
import ConfinementRecord from '../models/ConfinementRecord';
import User from '../models/User';

/**
 * GET /api/confinement
 * Clinic-admin or vet: list confinement records for their clinic/vet.
 */
export const listConfinementRecords = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const query: any = {};
    if (req.user.userType === 'veterinarian') {
      query.vetId = req.user.userId;
    } else {
      const user = await User.findById(req.user.userId);
      if (user?.clinicId) query.clinicId = user.clinicId;
    }

    const { status } = req.query;
    if (status && status !== 'all') query.status = status;

    const records = await ConfinementRecord.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ admissionDate: -1 });

    return res.status(200).json({ status: 'SUCCESS', data: { records } });
  } catch (error) {
    console.error('List confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * POST /api/confinement
 * Create a new confinement record.
 */
export const createConfinementRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ status: 'ERROR', message: 'User not found' });

    const { petId, reason, notes, admissionDate, appointmentId } = req.body;
    if (!petId || !reason || !admissionDate) {
      return res.status(400).json({ status: 'ERROR', message: 'petId, reason, and admissionDate are required' });
    }

    const record = await ConfinementRecord.create({
      petId,
      vetId: req.user.userId,
      clinicId: user.clinicId,
      clinicBranchId: user.clinicBranchId ?? undefined,
      appointmentId: appointmentId ?? undefined,
      reason,
      notes: notes || '',
      admissionDate: new Date(admissionDate),
      status: 'admitted',
    } as any);

    return res.status(201).json({ status: 'SUCCESS', data: { record } });
  } catch (error) {
    console.error('Create confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * PUT /api/confinement/:id
 * Update (discharge or update notes).
 */
export const updateConfinementRecord = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const record = await ConfinementRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ status: 'ERROR', message: 'Record not found' });

    const { notes, dischargeDate, status } = req.body;
    if (notes !== undefined) record.notes = notes;
    if (dischargeDate !== undefined) record.dischargeDate = new Date(dischargeDate);
    if (status !== undefined) record.status = status;

    await record.save();
    return res.status(200).json({ status: 'SUCCESS', data: { record } });
  } catch (error) {
    console.error('Update confinement error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * GET /api/confinement/pet/:petId
 * Get confinement history for a specific pet.
 */
export const getConfinementByPet = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });

    const records = await ConfinementRecord.find({ petId: req.params.petId })
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .sort({ admissionDate: -1 });

    return res.status(200).json({ status: 'SUCCESS', data: { records } });
  } catch (error) {
    console.error('Get confinement by pet error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
