import { authenticatedFetch } from './auth';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  status: 'available' | 'your-booking' | 'unavailable';
}

export interface Appointment {
  _id: string;
  petId: any;
  ownerId: any;
  vetId: any;
  clinicId: any;
  clinicBranchId: any;
  mode: 'online' | 'face-to-face';
  types: string[];
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Book a new appointment
 */
export const createAppointment = async (data: {
  petId: string;
  vetId: string;
  clinicId: string;
  clinicBranchId: string;
  mode: 'online' | 'face-to-face';
  types: string[];
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}, token?: string) => {
  return authenticatedFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify(data)
  }, token);
};

/**
 * Get available time slots for a vet on a date
 */
export const getAvailableSlots = async (vetId: string, date: string, token?: string): Promise<{ status: string; data?: { slots: TimeSlot[] } }> => {
  return authenticatedFetch(`/appointments/slots?vetId=${vetId}&date=${date}`, { method: 'GET' }, token);
};

/**
 * Get my appointments
 */
export const getMyAppointments = async (filter?: 'upcoming' | 'previous', token?: string): Promise<{ status: string; data?: { appointments: Appointment[] } }> => {
  const query = filter ? `?filter=${filter}` : '';
  return authenticatedFetch(`/appointments/mine${query}`, { method: 'GET' }, token);
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (id: string, token?: string) => {
  return authenticatedFetch(`/appointments/${id}/cancel`, { method: 'PATCH' }, token);
};
