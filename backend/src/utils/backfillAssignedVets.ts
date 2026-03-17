import Pet from '../models/Pet';
import Appointment from '../models/Appointment';

/**
 * One-time backfill: for every pet that has no assignedVetId but has at least
 * one completed appointment, set assignedVetId to the vet from the most recent
 * completed appointment.
 *
 * Safe to run on every server start — skips pets that already have the field set.
 */
export async function backfillAssignedVets(): Promise<void> {
  try {
    const unassigned = await Pet.find({ assignedVetId: null }).select('_id').lean();
    if (unassigned.length === 0) return;

    const petIds = unassigned.map((p) => p._id);

    // For each unassigned pet, find the most recent completed appointment
    const results = await Appointment.aggregate([
      { $match: { petId: { $in: petIds }, status: 'completed', vetId: { $ne: null } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$petId', vetId: { $first: '$vetId' } } },
    ]);

    if (results.length === 0) return;

    const bulkOps = results.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { assignedVetId: r.vetId } },
      },
    }));

    await Pet.bulkWrite(bulkOps);
    console.log(`[Backfill] Assigned vets to ${results.length} pet(s).`);
  } catch (err) {
    console.error('[Backfill] backfillAssignedVets error:', err);
  }
}
