import cron from 'node-cron';
import Vaccination from '../models/Vaccination';

export function startScheduler() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Running vaccination status refresh...');
    try {
      const now = new Date();
      // Mark expired
      const expiredResult = await Vaccination.updateMany(
        {
          status: 'active',
          expiryDate: { $lt: now },
        },
        { $set: { status: 'expired', isUpToDate: false } }
      );
      // Mark overdue (nextDueDate passed but not expired)
      const overdueResult = await Vaccination.updateMany(
        {
          status: 'active',
          nextDueDate: { $lt: now },
          $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }],
        },
        { $set: { status: 'overdue', isUpToDate: false } }
      );
      console.log(`[Scheduler] Marked ${expiredResult.modifiedCount} expired, ${overdueResult.modifiedCount} overdue`);
    } catch (err) {
      console.error('[Scheduler] Error during status refresh:', err);
    }
  });
  console.log('[Scheduler] Vaccination status refresh scheduled (daily midnight)');
}
