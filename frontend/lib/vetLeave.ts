import { authenticatedFetch } from './auth';

export interface VetLeave {
  _id: string;
  date: string;
  reason: string | null;
  status: 'active' | 'cancelled';
  affectedAppointmentCount: number;
}

export interface LeaveConflict {
  appointmentId: string;
  petName: string;
  ownerName: string;
  startTime: string;
  endTime: string;
  types: string[];
  branchName: string;
  availableVets: { _id: string; firstName: string; lastName: string }[];
}

export interface LeaveDecision {
  appointmentId: string;
  action: 'reassign' | 'cancel';
  newVetId?: string;
}

/**
 * Preview conflicts for a proposed leave date (no side effects).
 */
export const previewLeave = async (
  date: string,
  token: string
): Promise<{ status: string; message?: string; data?: { affectedAppointments: LeaveConflict[] } }> => {
  return authenticatedFetch('/vet-leave/preview', {
    method: 'POST',
    body: JSON.stringify({ date }),
  }, token);
};

/**
 * File a leave with optional decisions for affected appointments.
 */
export const applyLeave = async (
  data: { date: string; reason?: string; decisions: LeaveDecision[] },
  token: string
): Promise<{ status: string; message?: string; data?: { leave: VetLeave } }> => {
  return authenticatedFetch('/vet-leave', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

/**
 * Get the authenticated vet's active upcoming leaves.
 */
export const getMyLeaves = async (
  token: string
): Promise<{ status: string; message?: string; data?: { leaves: VetLeave[] } }> => {
  return authenticatedFetch('/vet-leave/mine', { method: 'GET' }, token);
};

/**
 * Cancel a filed leave.
 */
export const cancelLeave = async (
  leaveId: string,
  token: string
): Promise<{ status: string; message?: string }> => {
  return authenticatedFetch(`/vet-leave/${leaveId}`, { method: 'DELETE' }, token);
};
