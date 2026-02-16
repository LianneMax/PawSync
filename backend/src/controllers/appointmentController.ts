import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Pet from '../models/Pet';
import AssignedVet from '../models/AssignedVet';

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
