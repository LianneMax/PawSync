import mongoose, { Schema, Document } from 'mongoose';

export interface IPetNotes extends Document {
  petId: mongoose.Types.ObjectId;
  notes: string;
  updatedBy: mongoose.Types.ObjectId;
}

const PetNotesSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      unique: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IPetNotes>('PetNotes', PetNotesSchema);
