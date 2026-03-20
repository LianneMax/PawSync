import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'appointment_scheduled'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_reminder'
  | 'appointment_rescheduled'
  | 'bill_due'
  | 'bill_paid'
  | 'vaccine_due'
  | 'pet_lost'
  | 'pet_found'
  | 'clinic_new_appointment_booked'
  | 'clinic_appointment_cancelled'
  | 'clinic_appointment_rescheduled'
  | 'clinic_vet_application_submitted'
  | 'clinic_pet_tag_requested'
  | 'clinic_invoice_paid'
  | 'confinement_release_request'
  | 'confinement_release_confirmed'
  | 'pregnancy_confirmed'
  | 'pregnancy_due_soon'
  | 'pregnancy_overdue';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'appointment_scheduled',
        'appointment_cancelled',
        'appointment_completed',
        'appointment_reminder',
        'appointment_rescheduled',
        'bill_due',
        'bill_paid',
        'vaccine_due',
        'pet_lost',
        'pet_found',
        'clinic_new_appointment_booked',
        'clinic_appointment_cancelled',
        'clinic_appointment_rescheduled',
        'clinic_vet_application_submitted',
        'clinic_pet_tag_requested',
        'clinic_invoice_paid',
        'confinement_release_request',
        'confinement_release_confirmed',
        'pregnancy_confirmed',
        'pregnancy_due_soon',
        'pregnancy_overdue',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
