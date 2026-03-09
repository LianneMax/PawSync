import { Request, Response } from 'express';
import PetNotes from '../models/PetNotes';

/**
 * GET /api/pet-notes/:petId
 * Get the vet notepad for a pet (shared across all visits).
 */
export const getPetNotes = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;
    const record = await PetNotes.findOne({ petId });
    return res.json({ status: 'SUCCESS', data: { notes: record?.notes || '' } });
  } catch {
    return res.status(500).json({ status: 'ERROR', message: 'Server error' });
  }
};

/**
 * PUT /api/pet-notes/:petId
 * Upsert the vet notepad for a pet.
 */
export const upsertPetNotes = async (req: Request, res: Response) => {
  try {
    const { petId } = req.params;
    const { notes } = req.body;
    const record = await PetNotes.findOneAndUpdate(
      { petId },
      { notes: notes ?? '', updatedBy: req.user?.userId },
      { upsert: true, new: true }
    );
    return res.json({ status: 'SUCCESS', data: { notes: record.notes } });
  } catch {
    return res.status(500).json({ status: 'ERROR', message: 'Server error' });
  }
};
