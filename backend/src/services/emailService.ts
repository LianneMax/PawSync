import { Resend } from 'resend';

let resendClient: Resend | null = null;

export const getResend = (): Resend => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 'your_resend_key') {
      throw new Error('RESEND_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

export const FROM = 'PawSync <noreply@pawsync.app>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function emailHtml(body: string): string {
  return `<!DOCTYPE html><html><head><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background:#f9fafb;">${body}</body></html>`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

// ─── Appointment Booked ────────────────────────────────────────────────────────

export async function sendAppointmentBooked(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  clinicName: string;
  date: Date | string;
  startTime: string;
  types: string[];
  mode: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Appointment Confirmed',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Confirmed!</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Your appointment for <strong>${params.petName}</strong> has been booked successfully.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${params.types.join(', ')}</p>
            <p style="margin: 4px 0;"><strong>Mode:</strong> ${params.mode === 'online' ? 'Online Consultation' : 'Face-to-Face'}</p>
          </div>
          <p style="color: #666;">Please arrive 10 minutes early for face-to-face visits.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentBooked error:', err);
  }
}

// ─── Appointment Reminder (24h before) ────────────────────────────────────────

export async function sendAppointmentReminder(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  clinicName: string;
  date: Date | string;
  startTime: string;
  types: string[];
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Appointment Reminder (Tomorrow)',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Reminder</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>This is a reminder that <strong>${params.petName}</strong> has an appointment <strong>tomorrow</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${params.types.join(', ')}</p>
          </div>
          <p style="color: #666;">We look forward to seeing you and ${params.petName}!</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentReminder error:', err);
  }
}

// ─── Appointment Cancelled ────────────────────────────────────────────────────

export async function sendAppointmentCancelled(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  date: Date | string;
  startTime: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Appointment Cancelled',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Cancelled</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Your appointment for <strong>${params.petName}</strong> has been cancelled.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
          </div>
          <p style="color: #666;">You can rebook an appointment anytime through the PawSync app.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentCancelled error:', err);
  }
}

// ─── Appointment Reassigned (Vet on Leave) ────────────────────────────────────

export async function sendAppointmentReassigned(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  previousVetName: string;
  newVetName: string;
  clinicName: string;
  date: Date | string;
  startTime: string;
  types: string[];
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Appointment Reassigned',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Reassigned</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Your appointment for <strong>${params.petName}</strong> has been reassigned to a new veterinarian because Dr. ${params.previousVetName} will be on approved leave on that date.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>New Vet:</strong> Dr. ${params.newVetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${params.types.join(', ')}</p>
          </div>
          <p style="color: #666;">Your appointment time and location remain the same. We apologize for any inconvenience.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentReassigned error:', err);
  }
}

// ─── Appointment Cancelled – Vet on Leave ─────────────────────────────────────

export async function sendVetLeaveCancellation(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  date: Date | string;
  startTime: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Appointment Cancelled (Vet on Leave)',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Cancelled</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>We're sorry to inform you that your appointment for <strong>${params.petName}</strong> has been cancelled because Dr. ${params.vetName} will be on approved leave on that date.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Reason:</strong> Vet on approved leave</p>
          </div>
          <p style="color: #666;">You can rebook an appointment with another available veterinarian through the PawSync app. We apologize for the inconvenience.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendVetLeaveCancellation error:', err);
  }
}

// ─── Appointment Missed (auto-cancelled after 15 min no check-in) ────────────

export async function sendAppointmentMissed(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  clinicName: string;
  date: Date | string;
  startTime: string;
  types: string[];
  petId?: string;
  branchId?: string;
  vetId?: string;
}) {
  const query = new URLSearchParams();
  if (params.petId) query.set('petId', params.petId);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.vetId) query.set('vetId', params.vetId);
  if (params.types?.length) query.set('types', params.types.join(','));
  const rescheduleUrl = `${FRONTEND_URL}/my-appointments?${query.toString()}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Missed Appointment for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #900B09;">Missed Appointment</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>We noticed that your appointment for <strong>${params.petName}</strong> was not attended and has been automatically cancelled.</p>
          <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${params.types.join(', ')}</p>
          </div>
          <p style="color: #666;">Don't worry — you can reschedule anytime. Click the button below to book a new appointment with the same details pre-filled.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${rescheduleUrl}" style="background: #900B09; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Reschedule Appointment</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentMissed error:', err);
  }
}

// ─── Appointment Displaced by Emergency ──────────────────────────────────────

export async function sendAppointmentDisplacedByEmergency(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  clinicName: string;
  originalDate: Date | string;
  originalTime: string;
  newDate: Date | string;
  newTime: string;
  appointmentId: string;
  petId?: string;
  branchId?: string;
  vetId?: string;
  types?: string[];
}) {
  const cancelUrl = `${FRONTEND_URL}/my-appointments?appointmentId=${params.appointmentId}`;
  const rescheduleQuery = new URLSearchParams();
  if (params.petId) rescheduleQuery.set('petId', params.petId);
  if (params.branchId) rescheduleQuery.set('branchId', params.branchId);
  if (params.vetId) rescheduleQuery.set('vetId', params.vetId);
  if (params.types?.length) rescheduleQuery.set('types', params.types.join(','));
  const rescheduleUrl = `${FRONTEND_URL}/my-appointments?${rescheduleQuery.toString()}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Your Appointment for ${params.petName} Has Been Moved`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Appointment Rescheduled – Emergency Override</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>We sincerely apologize for the inconvenience. Your appointment for <strong>${params.petName}</strong> with <strong>Dr. ${params.vetName}</strong> at <strong>${params.clinicName}</strong> has been moved due to an emergency patient that required immediate attention.</p>
          <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #900B09;"><strong>Original Schedule</strong></p>
            <p style="margin: 4px 0; text-decoration: line-through; color: #900B09;">${formatDate(params.originalDate)} at ${params.originalTime}</p>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #166534;"><strong>New Schedule</strong></p>
            <p style="margin: 4px 0; color: #166534;">${formatDate(params.newDate)} at ${params.newTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
          </div>
          <p style="color: #444;">If this new schedule does not work for you, you may cancel and book a new appointment at a time that suits you best.</p>
          <div style="display: flex; gap: 12px; margin: 24px 0;">
            <a href="${cancelUrl}" style="background: #900B09; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-right: 12px;">Cancel Appointment</a>
            <a href="${rescheduleUrl}" style="background: #5A7C7A; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold;">Reschedule Instead</a>
          </div>
          <p style="color: #999; font-size: 12px;">We appreciate your understanding and patience. – PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentDisplacedByEmergency error:', err);
  }
}

// ─── Vaccination Due Reminder ─────────────────────────────────────────────────

export async function sendVaccinationDueReminder(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vaccineName: string;
  nextDueDate: Date | string;
  type: 'upcoming' | 'overdue';
}) {
  const isOverdue = params.type === 'overdue';
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: isOverdue
        ? `PawSync – Vaccination Overdue for ${params.petName}`
        : `PawSync – Vaccination Due in 7 Days for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">${isOverdue ? 'Vaccination Overdue' : 'Vaccination Due Soon'}</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>${isOverdue
            ? `<strong>${params.petName}</strong>'s <strong>${params.vaccineName}</strong> vaccination is now <strong>overdue</strong>.`
            : `<strong>${params.petName}</strong>'s <strong>${params.vaccineName}</strong> vaccination is due in 7 days.`
          }</p>
          <div style="background: ${isOverdue ? '#fef2f2' : '#f3f4f6'}; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Vaccine:</strong> ${params.vaccineName}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> ${formatDate(params.nextDueDate)}</p>
            <p style="margin: 4px 0; color: ${isOverdue ? '#dc2626' : '#666'};"><strong>Status:</strong> ${isOverdue ? 'OVERDUE' : 'Due in 7 days'}</p>
          </div>
          <p style="color: #666;">Please book an appointment with your vet to keep ${params.petName} up to date.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${FRONTEND_URL}/my-appointments" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Book Appointment</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendVaccinationDueReminder error:', err);
  }
}

// ─── Booster Appointment Scheduled (vet notification) ────────────────────────

export async function sendBoosterScheduledVet(params: {
  vetEmail: string;
  vetFirstName: string;
  petName: string;
  ownerName: string;
  vaccineName: string;
  boosterDate: Date | string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.vetEmail,
      subject: `PawSync – Booster Appointment Scheduled for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Booster Appointment Auto-Scheduled</h2>
          <p>Hi Dr. ${params.vetFirstName},</p>
          <p>A booster vaccination appointment has been automatically scheduled for your patient.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.petName}</p>
            <p style="margin: 4px 0;"><strong>Owner:</strong> ${params.ownerName}</p>
            <p style="margin: 4px 0;"><strong>Vaccine:</strong> ${params.vaccineName}</p>
            <p style="margin: 4px 0;"><strong>Scheduled Date:</strong> ${formatDate(params.boosterDate)}</p>
          </div>
          <p style="color: #666;">Please confirm or adjust this appointment in PawSync as needed.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendBoosterScheduledVet error:', err);
  }
}

// ─── Vaccination Due Reminder (vet notification) ──────────────────────────────

export async function sendVaccinationDueReminderVet(params: {
  vetEmail: string;
  vetFirstName: string;
  petName: string;
  ownerName: string;
  vaccineName: string;
  nextDueDate: Date | string;
  type: 'upcoming' | 'overdue';
}) {
  const isOverdue = params.type === 'overdue';
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.vetEmail,
      subject: isOverdue
        ? `PawSync – Vaccination Overdue: ${params.petName}`
        : `PawSync – Vaccination Due in 7 Days: ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">${isOverdue ? 'Vaccination Overdue' : 'Vaccination Due Soon'}</h2>
          <p>Hi Dr. ${params.vetFirstName},</p>
          <p>${isOverdue
            ? `Your patient <strong>${params.petName}</strong>'s <strong>${params.vaccineName}</strong> vaccination is now <strong>overdue</strong>.`
            : `Your patient <strong>${params.petName}</strong>'s <strong>${params.vaccineName}</strong> vaccination is due in 7 days.`
          }</p>
          <div style="background: ${isOverdue ? '#fef2f2' : '#f3f4f6'}; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.petName}</p>
            <p style="margin: 4px 0;"><strong>Owner:</strong> ${params.ownerName}</p>
            <p style="margin: 4px 0;"><strong>Vaccine:</strong> ${params.vaccineName}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> ${formatDate(params.nextDueDate)}</p>
            <p style="margin: 4px 0; color: ${isOverdue ? '#dc2626' : '#666'};"><strong>Status:</strong> ${isOverdue ? 'OVERDUE' : 'Due in 7 days'}</p>
          </div>
          <p style="color: #666;">Please follow up with the owner to schedule an appointment.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendVaccinationDueReminderVet error:', err);
  }
}

// ─── Lost Pet Confirmation (owner marked pet as lost) ─────────────────────────

export async function sendLostPetConfirmation(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  petId: string;
  species: string;
}) {
  const publicUrl = `${FRONTEND_URL}/pet/${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – ${params.petName} Has Been Marked as Lost`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Your Pet Has Been Reported Missing</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>We've marked <strong>${params.petName}</strong>'s profile as lost. Share the link below so anyone who finds your ${params.species} can contact you.</p>
          <div style="background: #fef9c3; border: 1px solid #fde047; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Public Profile Link:</strong></p>
            <a href="${publicUrl}" style="color: #5A7C7A; word-break: break-all;">${publicUrl}</a>
          </div>
          <p style="color: #666;">If you find ${params.petName}, you can mark them as found in the PawSync app.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendLostPetConfirmation error:', err);
  }
}

// ─── Lost Pet Scan Alert (someone viewed the lost pet's public profile) ────────

export async function sendLostPetScanAlert(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  petId: string;
}) {
  const publicUrl = `${FRONTEND_URL}/pet/${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Someone Scanned ${params.petName}'s NFC/QR Pet Tag`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Someone Found ${params.petName}!</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Someone just scanned <strong>${params.petName}</strong>&apos;s NFC/QR Pet Tag and viewed their public profile. They may be trying to return your pet.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0;">Your contact information is visible on the public profile so they can reach you directly.</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${publicUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">View Public Profile</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendLostPetScanAlert error:', err);
  }
}

// ─── Pet Found Alert (finder shared location) ─────────────────────────────────

export async function sendPetFoundAlert(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  petId: string;
  scannedAt?: Date | string;
  latitude?: number;
  longitude?: number;
}) {
  const publicUrl = `${FRONTEND_URL}/pet/${params.petId}`;
  const hasCoords = typeof params.latitude === 'number' && typeof params.longitude === 'number';
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Someone Shared a Location for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Someone Shared a Location for ${params.petName}</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>A finder shared their location with you from <strong>${params.petName}</strong>&apos;s public profile.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            ${params.scannedAt ? `<p style="margin: 4px 0;"><strong>Reported At:</strong> ${formatDate(params.scannedAt)}</p>` : ''}
            ${hasCoords ? `<p style="margin: 4px 0;"><strong>Coordinates:</strong> ${params.latitude}, ${params.longitude}</p>` : ''}
            <p style="margin: 4px 0;">Open your pet profile to review details and contact information.</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${publicUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Open Pet Profile</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetFoundAlert error:', err);
  }
}

// ─── Pet Found Confirmation (owner marked pet as found) ─────────────────────

export async function sendPetFoundConfirmation(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  petId: string;
}) {
  const petUrl = `${FRONTEND_URL}/my-pets/${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – ${params.petName} Marked as Found`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">${params.petName} Is Marked as Found</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>You successfully marked <strong>${params.petName}</strong> as found.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0;">Lost status, alerts, and appointments have been cleared for this pet.</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${petUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Open My Pet Profile</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetFoundConfirmation error:', err);
  }
}

// ─── Pet Deceased Notice ─────────────────────────────────────────────────────

export async function sendPetDeceasedNotice(params: {
  recipientEmail: string;
  recipientName: string;
  petName: string;
  deceasedAt?: Date | string | null;
  markedBy: string;
}) {
  const markedOn = params.deceasedAt ? formatDate(params.deceasedAt) : 'a recent date';
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: `PawSync – ${params.petName} Marked as Deceased`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">With Sympathy</h2>
          <p>Hi ${params.recipientName},</p>
          <p><strong>${params.petName}</strong> has been marked as deceased by <strong>${params.markedBy}</strong> on <strong>${markedOn}</strong>.</p>
          <p>We know this is an incredibly difficult time. ${params.petName}'s medical history will remain preserved in read-only format as a lasting record of the care received.</p>
          <p>Our thoughts are with you during this loss.</p>
          <p style="margin-top: 20px;">With care,<br/>PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetDeceasedNotice error:', err);
  }
}

// ─── Pet Ownership Transferred Notice ───────────────────────────────────────

export async function sendPetOwnershipTransferredNotice(params: {
  recipientEmail: string;
  recipientName: string;
  petName: string;
  oldOwnerName: string;
  newOwnerName: string;
  transferDate: Date | string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: `PawSync – ${params.petName} Ownership Transferred`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Pet Ownership Updated</h2>
          <p>Hi ${params.recipientName},</p>
          <p>The ownership for <strong>${params.petName}</strong> has been transferred.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Previous Owner:</strong> ${params.oldOwnerName}</p>
            <p style="margin: 4px 0;"><strong>New Owner:</strong> ${params.newOwnerName}</p>
            <p style="margin: 4px 0;"><strong>Transfer Date:</strong> ${formatDate(params.transferDate)}</p>
            <p style="margin: 4px 0;">Full medical history and appointments were moved to the new owner.</p>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetOwnershipTransferredNotice error:', err);
  }
}

// ─── Vet Branch Invitation ────────────────────────────────────────────────────

export async function sendVetInvitation(params: {
  vetEmail: string;
  vetFirstName: string;
  vetLastName: string;
  branchName: string;
  clinicName: string;
  acceptUrl: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.vetEmail,
      subject: `Invitation to Join ${params.branchName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">You've Been Invited!</h2>
          <p>Hello Dr. ${params.vetFirstName} ${params.vetLastName},</p>
          <p>You have been invited to join <strong>${params.branchName}</strong> in our veterinary system.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Branch:</strong> ${params.branchName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
          </div>
          <p>Please confirm your acceptance by clicking the button below:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${params.acceptUrl}" style="background: #5A7C7A; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666;">If you accept this invitation, your current branch assignment will be updated to <strong>${params.branchName}</strong>.</p>
          <p style="color: #999; font-size: 12px;">If you did not expect this invitation, you may ignore this email.</p>
          <p style="color: #999; font-size: 12px;">This invitation link expires in 7 days.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendVetInvitation error:', err);
  }
}

// ─── Billing – Payment Due (vet approved invoice) ─────────────────────────────

export async function sendBillingPendingPayment(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  items: { name: string; unitPrice: number }[];
  subtotal: number;
  discount: number;
  totalAmountDue: number;
  serviceDate: Date | string;
}) {
  const itemRows = params.items
    .map(item => `<tr><td style="padding:6px 0;">${item.name}</td><td style="padding:6px 0;text-align:right;">${formatCurrency(item.unitPrice)}</td></tr>`)
    .join('');
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Invoice Ready for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Invoice Ready – Payment Due</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>An invoice for <strong>${params.petName}</strong>'s visit has been approved and is ready for payment.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Service Date:</strong> ${formatDate(params.serviceDate)}</p>
            <p style="margin: 0 0 12px;"><strong>Veterinarian:</strong> Dr. ${params.vetName}</p>
            <table style="width: 100%; border-top: 1px solid #e5e7eb; margin-top: 8px;">
              ${itemRows}
              ${params.discount > 0 ? `<tr><td style="padding:6px 0;color:#666;">Discount</td><td style="padding:6px 0;text-align:right;color:#22c55e;">-${formatCurrency(params.discount)}</td></tr>` : ''}
              <tr style="border-top: 2px solid #d1d5db; font-weight: bold;">
                <td style="padding: 10px 0;">Total Due</td>
                <td style="padding: 10px 0; text-align: right; color: #5A7C7A; font-size: 18px;">${formatCurrency(params.totalAmountDue)}</td>
              </tr>
            </table>
          </div>
          <p style="color: #666;">Please proceed to the clinic to settle your balance.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendBillingPendingPayment error:', err);
  }
}

// ─── Billing – Payment Receipt ────────────────────────────────────────────────

export async function sendBillingPaidReceipt(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  items: { name: string; unitPrice: number }[];
  subtotal: number;
  discount: number;
  totalAmountDue: number;
  serviceDate: Date | string;
  paidAt: Date | string;
}) {
  const itemRows = params.items
    .map(item => `<tr><td style="padding:6px 0;">${item.name}</td><td style="padding:6px 0;text-align:right;">${formatCurrency(item.unitPrice)}</td></tr>`)
    .join('');
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Payment Received for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Payment Confirmed ✓</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Thank you! Payment for <strong>${params.petName}</strong>'s visit has been received.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Service Date:</strong> ${formatDate(params.serviceDate)}</p>
            <p style="margin: 0 0 8px;"><strong>Paid On:</strong> ${formatDate(params.paidAt)}</p>
            <p style="margin: 0 0 12px;"><strong>Veterinarian:</strong> Dr. ${params.vetName}</p>
            <table style="width: 100%; border-top: 1px solid #bbf7d0; margin-top: 8px;">
              ${itemRows}
              ${params.discount > 0 ? `<tr><td style="padding:6px 0;color:#666;">Discount</td><td style="padding:6px 0;text-align:right;color:#22c55e;">-${formatCurrency(params.discount)}</td></tr>` : ''}
              <tr style="border-top: 2px solid #bbf7d0; font-weight: bold;">
                <td style="padding: 10px 0;">Amount Paid</td>
                <td style="padding: 10px 0; text-align: right; color: #16a34a; font-size: 18px;">${formatCurrency(params.totalAmountDue)}</td>
              </tr>
            </table>
          </div>
          <p style="color: #666;">Thank you for trusting PawSync with ${params.petName}'s care.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendBillingPaidReceipt error:', err);
  }
}

// ─── Generic Clinic Admin Alert ───────────────────────────────────────────────

export async function sendClinicAdminAlertEmail(params: {
  adminEmail: string;
  adminFirstName: string;
  subject: string;
  headline: string;
  intro: string;
  details?: Record<string, string | number | null | undefined>;
}) {
  try {
    const detailRows = Object.entries(params.details || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([label, value]) => `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 40%;">${label}</td>
          <td style="padding: 6px 0; color: #111827;">${value}</td>
        </tr>
      `)
      .join('');

    await getResend().emails.send({
      from: FROM,
      to: params.adminEmail,
      subject: params.subject,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A; margin: 0 0 12px;">${params.headline}</h2>
          <p style="margin: 0 0 10px;">Hi ${params.adminFirstName},</p>
          <p style="margin: 0 0 16px; color: #374151;">${params.intro}</p>
          ${detailRows ? `
            <div style="background: #f3f4f6; padding: 14px; border-radius: 12px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse;">${detailRows}</table>
            </div>
          ` : ''}
          <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendClinicAdminAlertEmail error:', err);
  }
}

// ─── Confinement Release Emails ──────────────────────────────────────────────

export async function sendConfinementReleaseRequestToVet(params: {
  vetEmail: string;
  vetFirstName: string;
  ownerName: string;
  petName: string;
  petId: string;
  reason?: string;
}) {
  const petUrl = `${FRONTEND_URL}/pet/${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.vetEmail,
      subject: `PawSync – Confinement Release Requested for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Confinement Release Request</h2>
          <p>Hi Dr. ${params.vetFirstName},</p>
          <p><strong>${params.ownerName}</strong> requested confinement release for <strong>${params.petName}</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Pet:</strong> ${params.petName}</p>
            <p style="margin: 4px 0;"><strong>Requested By:</strong> ${params.ownerName}</p>
            ${params.reason ? `<p style="margin: 4px 0;"><strong>Owner Note:</strong> ${params.reason}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${petUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Review Pet Record</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendConfinementReleaseRequestToVet error:', err);
  }
}

export async function sendReferralToVet(params: {
  referredVetEmail: string;
  referredVetFirstName: string;
  referringVetName: string;
  referringBranchName: string;
  referredBranchName: string;
  ownerName: string;
  petName: string;
  petId: string;
  reason: string;
}) {
  const recordsUrl = `${FRONTEND_URL}/patient-records?petId=${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.referredVetEmail,
      subject: `PawSync – You have a new patient referral: ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">New Patient Referral</h2>
          <p>Hi Dr. ${params.referredVetFirstName},</p>
          <p>Dr. ${params.referringVetName} at <strong>${params.referringBranchName}</strong> has referred a patient to you at <strong>${params.referredBranchName}</strong>.</p>
          <div style="background: #f0f9f8; border: 1px solid #99c4c2; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.petName}</p>
            <p style="margin: 4px 0;"><strong>Owner:</strong> ${params.ownerName}</p>
            <p style="margin: 4px 0;"><strong>Reason:</strong> ${params.reason}</p>
          </div>
          <p>The pet's full medical history has been shared with you. You can review it in the patient records section.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${recordsUrl}" style="background: #5A7C7A; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">View Patient Records</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendReferralToVet error:', err);
  }
}

export async function sendReferralToOwner(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  referringVetName: string;
  referredVetName: string;
  referredBranchName: string;
}) {
  const appointmentsUrl = `${FRONTEND_URL}/my-appointments`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – ${params.petName} has been referred to a specialist`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Your Pet Has Been Referred</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Dr. ${params.referringVetName} has referred <strong>${params.petName}</strong> to Dr. ${params.referredVetName} at <strong>${params.referredBranchName}</strong>.</p>
          <p>Their medical history has been shared with the referred veterinarian so they have full context before your visit.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${appointmentsUrl}" style="background: #5A7C7A; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">View My Appointments</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendReferralToOwner error:', err);
  }
}

export async function sendConfinementReleaseConfirmedToOwner(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  petId: string;
  vetName: string;
}) {
  const petUrl = `${FRONTEND_URL}/my-pets/${params.petId}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – ${params.petName} Has Been Released from Confinement`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Confinement Release Confirmed</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p><strong>${params.petName}</strong> has been released from confinement by Dr. ${params.vetName}.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Pet:</strong> ${params.petName}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> Discharged</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${petUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Open Pet Profile</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendConfinementReleaseConfirmedToOwner error:', err);
  }
}

// ─── Prescription Email ───────────────────────────────────────────────────────

export async function sendPrescriptionEmail(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  vetName: string;
  clinicName: string;
  visitDate: Date | string;
  medications: {
    name: string;
    dosage: string;
    route: string;
    frequency: string;
    duration: string;
    notes?: string;
  }[];
  preventiveCare: {
    careType: string;
    product: string;
    dateAdministered: Date | null;
    notes?: string;
  }[];
}) {
  const careTypeLabel: Record<string, string> = {
    flea: 'Flea Prevention',
    tick: 'Tick Prevention',
    heartworm: 'Heartworm Prevention',
    deworming: 'Deworming',
    other: 'Preventive Care',
  };

  const routeLabel: Record<string, string> = {
    oral: 'Oral',
    topical: 'Topical',
    injection: 'Injection',
    other: 'Other',
  };

  const medicationRows = params.medications.map((m) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">
        <strong>${m.name}</strong>
        ${m.notes ? `<br><span style="font-size: 11px; color: #6b7280;">${m.notes}</span>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${m.dosage}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${routeLabel[m.route] || m.route}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${m.frequency}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${m.duration}</td>
    </tr>
  `).join('');

  const preventiveCareRows = params.preventiveCare.map((p) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">
        <strong>${careTypeLabel[p.careType] || p.careType}</strong>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${p.product}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">
        ${p.dateAdministered ? formatDate(p.dateAdministered) : 'N/A'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${p.notes || '—'}</td>
    </tr>
  `).join('');

  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Prescription & Care Summary for ${params.petName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff;">

          <!-- Header -->
          <div style="background: #5A7C7A; border-radius: 14px; padding: 24px 28px; margin-bottom: 24px;">
            <h1 style="color: #ffffff; margin: 0 0 4px; font-size: 22px; letter-spacing: 0.5px;">Prescription & Care Summary</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 13px;">${params.clinicName}</p>
          </div>

          <p style="color: #374151; margin: 0 0 6px;">Hi ${params.ownerFirstName},</p>
          <p style="color: #374151; margin: 0 0 20px;">
            Following <strong>${params.petName}</strong>'s visit on <strong>${formatDate(params.visitDate)}</strong>,
            Dr. ${params.vetName} has prescribed the following medications and care. Please follow all instructions carefully.
          </p>

          <!-- Visit Info -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; border-radius: 12px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #374151;"><strong>Patient:</strong> ${params.petName}</p>
            <p style="margin: 0 0 4px; font-size: 13px; color: #374151;"><strong>Veterinarian:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Visit Date:</strong> ${formatDate(params.visitDate)}</p>
          </div>

          ${params.medications.length > 0 ? `
          <!-- Medications -->
          <h3 style="color: #5A7C7A; font-size: 15px; margin: 0 0 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            Prescribed Medications
          </h3>
          <div style="overflow-x: auto; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Medication</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Dosage</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Route</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Frequency</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Duration</th>
                </tr>
              </thead>
              <tbody>${medicationRows}</tbody>
            </table>
          </div>
          ` : ''}

          ${params.preventiveCare.length > 0 ? `
          <!-- Preventive Care -->
          <h3 style="color: #5A7C7A; font-size: 15px; margin: 0 0 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            Preventive Care Administered
          </h3>
          <div style="overflow-x: auto; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Type</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Product</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Date Given</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Notes</th>
                </tr>
              </thead>
              <tbody>${preventiveCareRows}</tbody>
            </table>
          </div>
          ` : ''}

          <!-- Reminder -->
          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 14px 16px; border-radius: 12px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
              <strong>Important:</strong> Complete the full course of any prescribed medication even if ${params.petName} appears to feel better. Contact your veterinarian if you notice any adverse reactions.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin: 0;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPrescriptionEmail error:', err);
  }
}

// ─── Pet Tag Ready Email ──────────────────────────────────────────────────────

export async function sendPetTagReadyEmail(params: {
  ownerEmail: string;
  ownerFirstName: string;
  petName: string;
  clinicName: string;
  branchName?: string;
  pickupDate?: Date | string | null;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Your NFC Tag for ${params.petName} is Ready`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Your Pet Tag is Ready!</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>Great news! The NFC tag you requested for <strong>${params.petName}</strong> is now ready for pickup.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Pet:</strong> ${params.petName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Clinic:</strong> ${params.clinicName}${params.branchName ? ` — ${params.branchName}` : ''}</p>
            ${params.pickupDate ? `<p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Scheduled Pickup:</strong> ${formatDate(params.pickupDate)}</p>` : ''}
          </div>
          <p style="color: #374151; font-size: 13px;">Please visit the clinic to collect your pet's NFC tag. Once attached, anyone who scans it will see ${params.petName}'s public profile.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetTagReadyEmail error:', err);
  }
}

// ─── Pet Transfer Invitation Email ───────────────────────────────────────────

export async function sendPetTransferInvitation(params: {
  toEmail: string;
  petName: string;
  transferredByName: string;
  invitationLink: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.toEmail,
      subject: `PawSync – ${params.petName} Has Been Transferred to You`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #476B6B; margin-bottom: 4px;">You have a pet waiting for you!</h2>
          <p style="color: #374151;">Hi there,</p>
          <p style="color: #374151;"><strong>${params.transferredByName}</strong> has transferred ownership of <strong>${params.petName}</strong> to you on PawSync.</p>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #166534;">What happens next?</p>
            <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
              <li>Click the button below to set up your free PawSync account</li>
              <li>${params.petName}&apos;s full profile and records are already in your account</li>
              <li>No additional setup needed, jump straight to your pet&apos;s profile</li>
            </ul>
          </div>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Pet being transferred</p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #476B6B;">${params.petName}</p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${params.invitationLink}" style="display: inline-block; background: #476B6B; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">
              Accept Transfer &amp; Set Up Account
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 8px; text-align: center;">This invitation expires in 7 days. If you did not expect this transfer, you can safely ignore this email.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendPetTransferInvitation error:', err);
  }
}

// ─── Branch Email OTP ─────────────────────────────────────────────────────────

export async function sendBranchOTP(params: {
  branchEmail: string;
  otp: string;
  branchName?: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.branchEmail,
      subject: 'PawSync – Branch Email Verification Code',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Verify Branch Email</h2>
          <p>Hello,</p>
          <p>You are receiving this email to verify the email address for ${params.branchName ? `<strong>${params.branchName}</strong>` : 'a new branch'} on PawSync.</p>
          <div style="background: #f0fdf4; border: 2px solid #7FA5A3; padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 8px; color: #4F4F4F; font-size: 14px;">Your verification code is:</p>
            <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #476B6B;">${params.otp}</p>
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendBranchOTP error:', err);
  }
}

// ─── New Branch Notification to Main Branch ───────────────────────────────────

export async function sendNewBranchNotification(params: {
  mainBranchEmail: string;
  mainBranchName: string;
  newBranchName: string;
  newBranchAddress: string;
  clinicName: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.mainBranchEmail,
      subject: `PawSync – New Branch Added: ${params.newBranchName}`,
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">New Branch Added</h2>
          <p>Hello,</p>
          <p>A new branch has been added to <strong>${params.clinicName}</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Branch Name:</strong> ${params.newBranchName}</p>
            <p style="margin: 4px 0;"><strong>Address:</strong> ${params.newBranchAddress}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
          </div>
          <p style="color: #666;">You can review and manage this branch from the Clinic Management page in PawSync.</p>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendNewBranchNotification error:', err);
  }
}

// ─── Guest Claim Invite ────────────────────────────────────────────────────────

export async function sendGuestClaimInviteEmail(params: {
  ownerEmail: string;
  ownerFirstName: string;
  clinicName: string;
  claimToken: string;
}) {
  try {
    // Point to the existing /signup page with claim context in query params.
    // The signup page detects claimToken and enters "claim mode" instead of
    // the standard registration flow.
    const claimUrl =
      `${FRONTEND_URL}/signup` +
      `?claimToken=${encodeURIComponent(params.claimToken)}` +
      `&claimEmail=${encodeURIComponent(params.ownerEmail)}` +
      `&claimFirstName=${encodeURIComponent(params.ownerFirstName)}`;

    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: 'PawSync – Claim Your Guest Appointment Records',
      html: emailHtml(`
        <div style="font-family: 'Outfit', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #5A7C7A;">Your Pet's Records Are Waiting!</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p><strong>${params.clinicName}</strong> recorded your pet's information during a recent visit and created a guest profile on your behalf.</p>
          <p>To access your pet's appointments, medical records, and billing history, create a free PawSync account — or sign in if you already have one.</p>
          <div style="background:#f3f4f6;border-radius:10px;padding:14px 18px;margin:20px 0;">
            <p style="margin:0;font-size:14px;color:#374151;">
              <strong>Important:</strong> You must sign up or sign in using this exact email address:<br/>
              <span style="color:#5A7C7A;font-weight:600;">${params.ownerEmail}</span><br/>
              <span style="font-size:12px;color:#6b7280;">Using a different email will not link your guest records.</span>
            </p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${claimUrl}" style="background:#5A7C7A;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              Sign In or Create Account to Claim Records
            </a>
          </div>
          <p style="color:#666;font-size:13px;">
            Or copy this link into your browser:<br/>
            <span style="color:#5A7C7A;word-break:break-all;">${claimUrl}</span>
          </p>
          <p style="color:#666;font-size:13px;">This link expires in 7 days. If you did not visit ${params.clinicName} recently, you can safely ignore this email.</p>
          <p style="color:#999;font-size:12px;">- PawSync Team</p>
        </div>
      `),
    });
  } catch (err) {
    console.error('[Email] sendGuestClaimInviteEmail error:', err);
  }
}

