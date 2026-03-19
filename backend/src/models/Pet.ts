import mongoose, { Schema, Document } from 'mongoose';

export interface IPet extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  species: 'canine' | 'feline';
  breed: string;
  secondaryBreed: string | null;
  sex: 'male' | 'female';
  dateOfBirth: Date;
  weight: number;
  sterilization: 'spayed' | 'unspayed' | 'neutered' | 'unneutered' | 'unknown';
  microchipNumber: string | null;
  nfcTagId: string | null;
  qrCode: string | null;
  photo: string | null;
  color: string | null;
  bloodType: string | null;
  allergies: string[];
  pregnancyStatus?: 'pregnant' | 'not_pregnant' | null;
  totalPregnancies: number;
  totalLitters: number;
  lastDeliveryDate: Date | null;
  assignedVetId: mongoose.Types.ObjectId | null;
  isLost: boolean;
  lostContactName: string | null;
  lostContactNumber: string | null;
  lostMessage: string | null;
  lostReportedByStranger: boolean;
  isConfined: boolean;
  confinedSince: Date | null;
  lastScannedLat: number | null;
  lastScannedLng: number | null;
  lastScannedAt: Date | null;
  scanLocations: { lat: number; lng: number; scannedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const PetSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Pet must belong to an owner'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Please provide the pet name'],
      trim: true
    },
    species: {
      type: String,
      enum: ['canine', 'feline'],
      required: [true, 'Please specify the species']
    },
    breed: {
      type: String,
      required: [true, 'Please specify the breed']
    },
    secondaryBreed: {
      type: String,
      default: null
    },
    sex: {
      type: String,
      enum: ['male', 'female'],
      required: [true, 'Please specify the sex']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Please provide the date of birth']
    },
    weight: {
      type: Number,
      required: [true, 'Please provide the weight in kg']
    },
    sterilization: {
      type: String,
      enum: ['spayed', 'unspayed', 'neutered', 'unneutered', 'unknown'],
      required: [true, 'Please specify sterilization status']
    },
    microchipNumber: {
      type: String,
      default: null
    },
    nfcTagId: {
      type: String,
      default: null,
      index: true
    },
    qrCode: {
      type: String,
      default: null
    },
    photo: {
      type: String,
      default: null
    },
    color: {
      type: String,
      default: null
    },
    bloodType: {
      type: String,
      default: null
    },
    allergies: {
      type: [String],
      default: []
    },
    totalPregnancies: {
      type: Number,
      default: 0,
    },
    totalLitters: {
      type: Number,
      default: 0,
    },
    lastDeliveryDate: {
      type: Date,
      default: null,
    },
    pregnancyStatus: {
      type: String,
      enum: ['pregnant', 'not_pregnant', null],
      default: null,
      validate: {
        validator(this: any, value: string | null) {
          if (value !== null && value !== undefined && this.sex === 'male') {
            return false;
          }
          return true;
        },
        message: 'Male pets cannot have a pregnancy status'
      }
    },
    assignedVetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isLost: {
      type: Boolean,
      default: false
    },
    lostReportedByStranger: {
      type: Boolean,
      default: false
    },
    lostContactName: {
      type: String,
      default: null
    },
    lostContactNumber: {
      type: String,
      default: null
    },
    lostMessage: {
      type: String,
      default: null
    },
    isConfined: {
      type: Boolean,
      default: false
    },
    confinedSince: {
      type: Date,
      default: null
    },
    lastScannedLat: {
      type: Number,
      default: null
    },
    lastScannedLng: {
      type: Number,
      default: null
    },
    lastScannedAt: {
      type: Date,
      default: null
    },
    scanLocations: {
      type: [{
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        scannedAt: { type: Date, default: Date.now }
      }],
      default: []
    }
  },
  {
    timestamps: true
  }
);

PetSchema.pre('save', async function () {
  if (this.sex === 'male') {
    this.pregnancyStatus = null as any;
  }
});

export default mongoose.model<IPet>('Pet', PetSchema);
