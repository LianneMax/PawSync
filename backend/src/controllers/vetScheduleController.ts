import { Request, Response } from 'express';
import VetSchedule from '../models/VetSchedule';
import VetApplication from '../models/VetApplication';
import ClinicBranch from '../models/ClinicBranch';

/**
 * Get vet's schedule for all approved branches
 */
export const getMySchedule = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    // Get all approved applications for this vet with branch details
    const approvedApps = await VetApplication.find({
      vetId: req.user.userId,
      status: 'approved'
    }).populate('branchId', 'name address openingTime closingTime operatingDays');

    // Get all existing schedules for this vet
    const schedules = await VetSchedule.find({ vetId: req.user.userId });
    const scheduleMap: Record<string, any> = {};
    schedules.forEach((s) => {
      scheduleMap[s.branchId.toString()] = s;
    });

    const result = approvedApps
      .filter((app) => app.branchId) // only include if branch populated
      .map((app) => {
        const branch = app.branchId as any;
        return {
          branchId: branch._id,
          branchName: branch.name,
          branchAddress: branch.address,
          branchOpeningTime: branch.openingTime,
          branchClosingTime: branch.closingTime,
          branchOperatingDays: branch.operatingDays,
          schedule: scheduleMap[branch._id.toString()] || null
        };
      });

    return res.status(200).json({ status: 'SUCCESS', data: { schedules: result } });
  } catch (error) {
    console.error('Get vet schedule error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Create or update vet's schedule for a specific branch
 */
export const upsertSchedule = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { branchId } = req.params;
    const { workingDays, startTime, endTime } = req.body;

    if (!workingDays || !startTime || !endTime) {
      return res.status(400).json({ status: 'ERROR', message: 'workingDays, startTime, and endTime are required' });
    }

    // Verify vet is approved at this branch
    const application = await VetApplication.findOne({
      vetId: req.user.userId,
      branchId,
      status: 'approved'
    });

    if (!application) {
      return res.status(403).json({ status: 'ERROR', message: 'You are not approved at this branch' });
    }

    // Get branch for validation
    const branch = await ClinicBranch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Validate working days are a subset of branch operating days
    if (branch.operatingDays.length > 0) {
      const invalidDays = (workingDays as string[]).filter((d) => !branch.operatingDays.includes(d));
      if (invalidDays.length > 0) {
        return res.status(400).json({
          status: 'ERROR',
          message: `Invalid working days: ${invalidDays.join(', ')}. Branch operates on: ${branch.operatingDays.join(', ')}`
        });
      }
    }

    // Validate times are within branch hours
    if (branch.openingTime && startTime < branch.openingTime) {
      return res.status(400).json({
        status: 'ERROR',
        message: `Start time cannot be before branch opening time (${branch.openingTime})`
      });
    }
    if (branch.closingTime && endTime > branch.closingTime) {
      return res.status(400).json({
        status: 'ERROR',
        message: `End time cannot be after branch closing time (${branch.closingTime})`
      });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ status: 'ERROR', message: 'Start time must be before end time' });
    }

    const schedule = await VetSchedule.findOneAndUpdate(
      { vetId: req.user.userId, branchId },
      { workingDays, startTime, endTime },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Schedule saved successfully',
      data: { schedule }
    });
  } catch (error) {
    console.error('Upsert vet schedule error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};
