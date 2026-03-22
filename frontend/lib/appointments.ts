import { authenticatedFetch } from './auth';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  status: 'available' | 'your-booking' | 'unavailable';
}

export interface Appointment {
  _id: string;
  petId: any;
  ownerId: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isGuest?: boolean;
    claimStatus?: 'unclaimed' | 'unclaimable' | 'invited' | 'claimed' | null;
    claimInviteSentAt?: string | null;
    [key: string]: any;
  };
  vetId: any;
  clinicId: any;
  clinicBranchId: any;
  mode: 'online' | 'face-to-face';
  types: string[];
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'rescheduled' | 'in_clinic' | 'in_progress' | 'cancelled' | 'completed';
  notes: string | null;
  isWalkIn: boolean;
  isEmergency: boolean;
  medicalRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicBranch {
  _id: string;
  name: string;
}

export interface AssignedVet {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  resignationStatus?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | null;
  resignationEndDate?: string | null;
  unavailableAfter?: string | null;
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
  /** Set to true only when scheduling a surgery appointment for a different clinic
   *  branch from the ScheduleSurgeryModal (care-plan referral flow). This allows
   *  the backend to permit cross-branch creation for surgery types only. */
  crossBranchSurgeryReferral?: boolean;
}, token?: string) => {
  return authenticatedFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify(data)
  }, token);
};

/**
 * Get clinic branches for the authenticated user's clinic.
 * Pass allBranches=true to return every active branch in the clinic regardless
 * of which branches the caller is personally assigned to (needed for cross-branch
 * surgery scheduling).
 */
export const getClinicBranches = async (token?: string, allBranches?: boolean): Promise<{ status: string; data?: ClinicBranch[] }> => {
  const qs = allBranches ? '?allBranches=true' : '';
  return authenticatedFetch(`/appointments/clinic-branches${qs}`, { method: 'GET' }, token);
};

/**
 * Get assigned vets for a specific clinic branch
 */
export const getAssignedVets = async (branchId: string, token?: string): Promise<{ status: string; data?: AssignedVet[] }> => {
  return authenticatedFetch(`/appointments/clinic-branches/${branchId}/vets`, { method: 'GET' }, token);
};

/**
 * Get available time slots for a vet on a date
 * Pass branchId to respect vet's working hours / branch operating hours
 */
export const getAvailableSlots = async (
  vetId: string,
  date: string,
  token?: string,
  branchId?: string
): Promise<{ status: string; data?: { slots: TimeSlot[]; isClosed?: boolean } }> => {
  const qs = branchId ? `&branchId=${branchId}` : '';
  return authenticatedFetch(`/appointments/slots?vetId=${vetId}&date=${date}${qs}`, { method: 'GET' }, token);
};

/**
 * Get appointments for the authenticated vet
 */
export const getVetAppointments = async (token?: string): Promise<{ status: string; data?: { appointments: Appointment[] } }> => {
  return authenticatedFetch('/appointments/vet', { method: 'GET' }, token);
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
  isGuest?: boolean;
  claimStatus?: 'unclaimed' | 'unclaimable' | 'invited' | 'claimed' | null;
  claimInviteSentAt?: string | null;
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
export const getPetsForOwner = async (ownerId: string, token?: string): Promise<{ status: string; data?: { pets: { _id: string; name: string; species: string; breed: string; photo: string | null; isLost: boolean; isAlive: boolean; status: 'alive' | 'lost' | 'deceased'; deceasedAt?: string | null }[] } }> => {
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
  isWalkIn?: boolean;
  isEmergency?: boolean;
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

/**
 * Check in a patient — transitions appointment from confirmed → in_progress
 * and auto-creates a draft medical record.
 * Returns { medicalRecordId } on success.
 */
export const checkInAppointment = async (
  id: string,
  token?: string
): Promise<{ status: string; message?: string; data?: { medicalRecordId?: string; appointment?: Appointment } }> => {
  return authenticatedFetch(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_progress' })
  }, token);
};

/**
 * Check in a patient to the clinic (clinic admin)
 */
export const clinicCheckInAppointment = async (
  id: string,
  token?: string
): Promise<{ status: string; message?: string; data?: { appointment?: Appointment } }> => {
  return authenticatedFetch(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_clinic' })
  }, token);
};

/**
 * Get a single appointment by ID
 */
export const getAppointmentById = async (id: string, token?: string): Promise<{ status: string; data?: Appointment }> => {
  return authenticatedFetch(`/appointments/${id}`, { method: 'GET' }, token);
};

/**
 * Reschedule an appointment to a new date/time (clinic admin)
 */
export const rescheduleAppointment = async (id: string, data: { date: string; startTime: string; endTime: string }, token?: string) => {
  return authenticatedFetch(`/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }, token);
};

// ==================== GUEST INTAKE ====================

export interface GuestOwnerData {
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail?: string;
  ownerContact?: string;
}

export interface GuestPetData {
  petName: string;
  petSpecies: 'canine' | 'feline';
  petBreed: string;
  petSex: 'male' | 'female';
  petDateOfBirth: string;
  petWeight: number;
  petSterilization: 'spayed' | 'unspayed' | 'neutered' | 'unneutered' | 'unknown';
}

/**
 * Create a guest intake appointment (no existing owner account required)
 */
export const createGuestIntakeAppointment = async (data: GuestOwnerData & GuestPetData & {
  vetId?: string;
  clinicBranchId: string;
  mode: 'face-to-face';
  types: string[];
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  isWalkIn?: boolean;
  isEmergency?: boolean;
}, token?: string) => {
  return authenticatedFetch('/appointments/clinic/guest-intake', {
    method: 'POST',
    body: JSON.stringify(data)
  }, token);
};

/**
 * Send a claim invite email to a guest owner (clinic admin)
 */
export const sendGuestClaimInvite = async (ownerId: string, token?: string): Promise<{
  status: string;
  message?: string;
  data?: { claimStatus: string; claimInviteSentAt: string };
}> => {
  return authenticatedFetch(`/appointments/clinic/guest/${ownerId}/send-claim-invite`, {
    method: 'POST'
  }, token);
};

/**
 * Update a guest owner's email (and optionally send claim invite) (clinic admin)
 */
export const updateGuestEmail = async (
  ownerId: string,
  data: { email: string; sendInvite?: boolean },
  token?: string
): Promise<{
  status: string;
  message?: string;
  data?: { claimStatus: string; email: string; claimInviteSentAt: string | null };
}> => {
  return authenticatedFetch(`/appointments/clinic/guest/${ownerId}/update-email`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }, token);
};
