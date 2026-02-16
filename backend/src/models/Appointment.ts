import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  vetId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  clinicBranchId: mongoose.Types.ObjectId;
  mode: 'online' | 'face-to-face';
  types: string[];
  date: Date;
  startTime: string; // e.g. "07:00"
  endTime: string;   // e.g. "07:30"
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
      index: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true
    },
    vetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Veterinarian is required'],
      index: true
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic is required']
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      required: [true, 'Clinic branch is required']
    },
    mode: {
      type: String,
      enum: ['online', 'face-to-face'],
      required: [true, 'Mode of appointment is required']
    },
    types: {
      type: [String],
      enum: ['consultation', 'vaccination', 'deworming', 'check-up'],
      required: [true, 'At least one appointment type is required'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'At least one appointment type is required'
      }
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
      index: true
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required']
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending'
    },
    notes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent double-booking: same vet, same date, same time slot
AppointmentSchema.index(
  { vetId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);
