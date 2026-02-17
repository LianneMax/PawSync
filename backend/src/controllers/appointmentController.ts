import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Pet from '../models/Pet';
import User from '../models/User';
import Clinic from '../models/Clinic';
import VetApplication from '../models/VetApplication';
import ClinicBranch from '../models/ClinicBranch';

/**
 * Generate 30-minute time slots for a day (default 7AM–5PM)
 */
function generateTimeSlots(startHour = 7, endHour = 17): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    const hStr = h.toString().padStart(2, '0');
    slots.push({ startTime: `${hStr}:00`, endTime: `${hStr}:30` });
    slots.push({ startTime: `${hStr}:30`, endTime: `${(h + 1).toString().padStart(2, '0')}:00` });
  }
  return slots;
}

/**
 * Create a new appointment
 */
export const createAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { petId, vetId, clinicId, clinicBranchId, mode, types, date, startTime, endTime, notes } = req.body;

    // Verify pet belongs to the user
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }
    if (pet.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ status: 'ERROR', message: 'You can only book appointments for your own pets' });
    }

    // Validate types based on mode
    if (mode === 'online') {
      if (types.length !== 1 || types[0] !== 'consultation') {
        return res.status(400).json({ status: 'ERROR', message: 'Online appointments can only be for consultation' });
      }
    }

    // Check if the slot is already taken
    const existing = await Appointment.findOne({
      vetId,
      date: new Date(date),
      startTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }

    const appointment = await Appointment.create({
      petId,
      ownerId: req.user.userId,
      vetId,
      clinicId,
      clinicBranchId,
      mode,
      types,
      date: new Date(date),
      startTime,
      endTime,
      notes: notes || null
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Appointment booked successfully',
      data: { appointment }
    });
  } catch (error: any) {
    console.error('Create appointment error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while booking the appointment' });
  }
};

/**
 * Get available time slots for a vet on a given date
 */
export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { vetId, date } = req.query;

    if (!vetId || !date) {
      return res.status(400).json({ status: 'ERROR', message: 'vetId and date are required' });
    }

    const queryDate = new Date(date as string);

    // Get all booked/pending slots for that vet on that date
    const booked = await Appointment.find({
      vetId: vetId as string,
      date: queryDate,
      status: { $in: ['pending', 'confirmed'] }
    }).select('startTime endTime status ownerId');

    // Get user's own bookings on that date with that vet
    const userBookings = booked.filter(
      (a) => a.ownerId.toString() === req.user!.userId
    );

    const allSlots = generateTimeSlots();

    const slots = allSlots.map((slot) => {
      const bookedSlot = booked.find((b) => b.startTime === slot.startTime);
      const isUserBooking = userBookings.some((b) => b.startTime === slot.startTime);

      let status: 'available' | 'your-booking' | 'unavailable' = 'available';
      if (isUserBooking) {
        status = 'your-booking';
      } else if (bookedSlot) {
        status = 'unavailable';
      }

      return { ...slot, status };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { slots }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching available slots' });
  }
};

/**
 * Get appointments for the authenticated user (pet owner)
 */
export const getMyAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const now = new Date();
    const filter = req.query.filter as string; // 'upcoming' or 'previous'

    const query: any = { ownerId: req.user.userId };

    if (filter === 'upcoming') {
      query.$or = [
        { date: { $gt: now } },
        { date: { $eq: now }, status: { $in: ['pending', 'confirmed'] } }
      ];
      query.status = { $in: ['pending', 'confirmed'] };
    } else if (filter === 'previous') {
      query.$or = [
        { date: { $lt: now } },
        { status: { $in: ['completed', 'cancelled'] } }
      ];
    }

    const appointments = await Appointment.find(query)
      .populate('petId', 'name species breed photo')
      .populate('vetId', 'firstName lastName')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .sort({ date: filter === 'upcoming' ? 1 : -1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching appointments' });
  }
};

/**
 * Get appointments for a vet
 */
export const getVetAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointments = await Appointment.find({ vetId: req.user.userId })
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email')
      .populate('clinicId', 'name')
      .populate('clinicBranchId', 'name address')
      .sort({ date: -1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get vet appointments error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching appointments' });
  }
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    const isOwner = appointment.ownerId.toString() === req.user.userId;
    const isVet = appointment.vetId.toString() === req.user.userId;

    if (!isOwner && !isVet) {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to cancel this appointment' });
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({ status: 'ERROR', message: `Cannot cancel a ${appointment.status} appointment` });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while cancelling the appointment' });
  }
};

/**
 * Update appointment status (vet confirms / completes)
 */
export const updateAppointmentStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ status: 'ERROR', message: 'Appointment not found' });
    }

    if (appointment.vetId.toString() !== req.user.userId && req.user.userType !== 'clinic-admin') {
      return res.status(403).json({ status: 'ERROR', message: 'Not authorized to update this appointment' });
    }

    const { status } = req.body;
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled']
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
      return res.status(400).json({ status: 'ERROR', message: `Cannot change status from ${appointment.status} to ${status}` });
    }

    appointment.status = status;
    await appointment.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Appointment ${status} successfully`,
      data: { appointment }
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred' });
  }
};

/**
 * Get approved vets for a specific clinic branch (for appointment booking)
 */
export const getVetsForBranch = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ status: 'ERROR', message: 'branchId is required' });
    }

    // Verify branch exists and is active
    const branch = await ClinicBranch.findOne({ _id: branchId, isActive: true });
    if (!branch) {
      return res.status(404).json({ status: 'ERROR', message: 'Branch not found' });
    }

    // Find approved vet applications for this branch
    const approvedApplications = await VetApplication.find({
      branchId: branchId as string,
      status: 'approved'
    }).populate('vetId', 'firstName lastName email');

    const vets = approvedApplications
      .filter((app) => app.vetId)
      .map((app) => {
        const vet = app.vetId as any;
        return {
          _id: vet._id,
          firstName: vet.firstName,
          lastName: vet.lastName,
          email: vet.email,
        };
      });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vets }
    });
  } catch (error) {
    console.error('Get vets for branch error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vets' });
  }
};

// ==================== CLINIC ADMIN ENDPOINTS ====================

/**
 * Search pet owners by name (clinic admin)
 */
export const searchPetOwners = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { q } = req.query;
    if (!q || (q as string).trim().length < 2) {
      return res.status(200).json({ status: 'SUCCESS', data: { owners: [] } });
    }

    const searchRegex = new RegExp((q as string).trim(), 'i');
    const owners = await User.find({
      userType: 'pet-owner',
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    })
      .select('firstName lastName email')
      .limit(20)
      .sort({ firstName: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { owners }
    });
  } catch (error) {
    console.error('Search pet owners error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while searching pet owners' });
  }
};

/**
 * Get pets for a specific owner (clinic admin)
 */
export const getPetsForOwner = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'ownerId is required' });
    }

    const pets = await Pet.find({ ownerId: ownerId as string })
      .select('name species breed photo')
      .sort({ name: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { pets }
    });
  } catch (error) {
    console.error('Get pets for owner error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching pets' });
  }
};

/**
 * Create an appointment on behalf of a pet owner (clinic admin)
 */
export const createClinicAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { ownerId, petId, vetId, clinicId, clinicBranchId, mode, types, date, startTime, endTime, notes } = req.body;

    if (!ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'Owner is required' });
    }

    // Verify the pet belongs to the specified owner
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({ status: 'ERROR', message: 'Pet not found' });
    }
    if (pet.ownerId.toString() !== ownerId) {
      return res.status(400).json({ status: 'ERROR', message: 'Pet does not belong to the selected owner' });
    }

    // Validate types based on mode
    if (mode === 'online') {
      if (types.length !== 1 || types[0] !== 'consultation') {
        return res.status(400).json({ status: 'ERROR', message: 'Online appointments can only be for consultation' });
      }
    }

    // Check if the slot is already taken
    const existing = await Appointment.findOne({
      vetId,
      date: new Date(date),
      startTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }

    const appointment = await Appointment.create({
      petId,
      ownerId,
      vetId,
      clinicId,
      clinicBranchId,
      mode,
      types,
      date: new Date(date),
      startTime,
      endTime,
      notes: notes || null,
      status: 'confirmed' // Clinic admin appointments are auto-confirmed
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Appointment booked successfully',
      data: { appointment }
    });
  } catch (error: any) {
    console.error('Create clinic appointment error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ status: 'ERROR', message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'This time slot is no longer available' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while booking the appointment' });
  }
};

/**
 * Get all appointments for the clinic admin's clinic (for calendar view)
 */
export const getClinicAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const clinic = await Clinic.findOne({ adminId: req.user.userId, isActive: true });
    if (!clinic) {
      return res.status(404).json({ status: 'ERROR', message: 'Clinic not found' });
    }

    const { date, branchId, filter } = req.query;
    const query: any = { clinicId: clinic._id };

    if (branchId) {
      query.clinicBranchId = branchId;
    }

    if (date) {
      // Use date range to avoid timezone exact-match issues
      const dayStart = new Date(date as string);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date as string);
      dayEnd.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: dayStart, $lte: dayEnd };
    }

    const now = new Date();
    if (filter === 'upcoming') {
      query.status = { $in: ['pending', 'confirmed'] };
      if (!date) {
        query.date = { $gte: new Date(now.toISOString().split('T')[0]) };
      }
    } else if (filter === 'previous') {
      query.$or = [
        { date: { $lt: new Date(now.toISOString().split('T')[0]) } },
        { status: { $in: ['completed', 'cancelled'] } }
      ];
    }

    const appointments = await Appointment.find(query)
      .populate('petId', 'name species breed photo')
      .populate('ownerId', 'firstName lastName email')
      .populate('vetId', 'firstName lastName email')
      .populate('clinicBranchId', 'name address')
      .sort({ date: 1, startTime: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { appointments }
    });
  } catch (error) {
    console.error('Get clinic appointments error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching appointments' });
  }
};
