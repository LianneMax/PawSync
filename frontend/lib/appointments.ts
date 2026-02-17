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

// ==================== CLINIC ADMIN ====================

export interface PetOwner {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Search pet owners by name (clinic admin)
 */
export const searchPetOwners = async (query: string, token?: string): Promise<{ status: string; data?: { owners: PetOwner[] } }> => {
  return authenticatedFetch(`/appointments/clinic/search-owners?q=${encodeURIComponent(query)}`, { method: 'GET' }, token);
};

/**
 * Get pets for a specific owner (clinic admin)
 */
export const getPetsForOwner = async (ownerId: string, token?: string): Promise<{ status: string; data?: { pets: { _id: string; name: string; species: string; breed: string; photo: string | null }[] } }> => {
  return authenticatedFetch(`/appointments/clinic/owner-pets?ownerId=${ownerId}`, { method: 'GET' }, token);
};

/**
 * Create appointment on behalf of a pet owner (clinic admin)
 */
export const createClinicAppointment = async (data: {
  ownerId: string;
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
  return authenticatedFetch('/appointments/clinic', {
    method: 'POST',
    body: JSON.stringify(data)
  }, token);
};

/**
 * Get clinic appointments (clinic admin)
 */
export const getClinicAppointments = async (params: {
  date?: string;
  branchId?: string;
  filter?: 'upcoming' | 'previous';
}, token?: string): Promise<{ status: string; data?: { appointments: Appointment[] } }> => {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.filter) query.set('filter', params.filter);
  const qs = query.toString();
  return authenticatedFetch(`/appointments/clinic${qs ? `?${qs}` : ''}`, { method: 'GET' }, token);
};

/**
 * Update appointment status (clinic admin / vet)
 */
export const updateAppointmentStatus = async (id: string, status: string, token?: string) => {
  return authenticatedFetch(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }, token);
};
