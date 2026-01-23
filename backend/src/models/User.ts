import mongoose, { Schema, Document } from 'mongoose';
import bcryptjs from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: 'pet-owner' | 'veterinarian';
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
      index: true
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false // Don't return password by default
    },
    firstName: {
      type: String,
      required: [true, 'Please provide a first name']
    },
    lastName: {
      type: String,
      required: [true, 'Please provide a last name']
    },
    userType: {
      type: String,
      enum: ['pet-owner', 'veterinarian'],
      required: [true, 'Please specify user type']
    },
    isVerified: {
      type: Boolean,
      default: false // For veterinarians, this tracks PRC license verification
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (this: IUser) {
  // Only hash password if it's new or modified
  if (!this.isModified('password')) {
    return;
  }

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return await bcryptjs.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
