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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
    });
  } catch (err) {
    console.error('[Email] sendAppointmentCancelled error:', err);
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
}) {
  const rescheduleUrl = `${FRONTEND_URL}/my-appointments`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: params.ownerEmail,
      subject: `PawSync – Missed Appointment for ${params.petName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #b45309;">Missed Appointment</h2>
          <p>Hi ${params.ownerFirstName},</p>
          <p>We noticed that your appointment for <strong>${params.petName}</strong> was not attended and has been automatically cancelled.</p>
          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(params.date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${params.startTime}</p>
            <p style="margin: 4px 0;"><strong>Vet:</strong> Dr. ${params.vetName}</p>
            <p style="margin: 4px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${params.types.join(', ')}</p>
          </div>
          <p style="color: #666;">Don't worry — you can reschedule anytime. Click the button below to book a new appointment.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${rescheduleUrl}" style="background: #7FA5A3; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Reschedule Appointment</a>
          </div>
          <p style="color: #999; font-size: 12px;">- PawSync Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Email] sendAppointmentMissed error:', err);
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
    });
  } catch (err) {
    console.error('[Email] sendPetFoundConfirmation error:', err);
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
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
      `,
    });
  } catch (err) {
    console.error('[Email] sendBillingPaidReceipt error:', err);
  }
}
