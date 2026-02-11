import mongoose, { Schema, Document } from 'mongoose';

export interface IPet extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  secondaryBreed: string | null;
  sex: 'male' | 'female';
  dateOfBirth: Date;
  weight: number;
  sterilization: 'yes' | 'no' | 'unknown';
  microchipNumber: string | null;
  nfcTagId: string | null;
  photo: string | null;
  notes: string | null;
  allergies: string[];
  isLost: boolean;
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
      enum: ['dog', 'cat'],
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
      enum: ['yes', 'no', 'unknown'],
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
    photo: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: null
    },
    allergies: {
      type: [String],
      default: []
    },
    isLost: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IPet>('Pet', PetSchema);
