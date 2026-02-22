import mongoose, { Schema, Document } from 'mongoose';
import bcryptjs from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  userType: 'pet-owner' | 'veterinarian' | 'clinic-admin' | 'branch-admin';
  clinicId: mongoose.Types.ObjectId | null;
  clinicBranchId: mongoose.Types.ObjectId | null;
  branchId: mongoose.Types.ObjectId | null;
  isMainBranch: boolean;
  isVerified: boolean;
  loginAttempts: number;
  lockUntil: Date | null;
  resetOtp: string | null;
  resetOtpExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  isLocked(): boolean;
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
    contactNumber: {
      type: String,
      default: null,
      sparse: true // Allow null values
      //match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid contact number']
    },
    userType: {
      type: String,
      enum: ['pet-owner', 'veterinarian', 'clinic-admin', 'branch-admin'],
      required: [true, 'Please specify user type']
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null
    },
    clinicBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'ClinicBranch',
      default: null
    },
    isMainBranch: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false // For veterinarians, this tracks PRC license verification
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    resetOtp: {
      type: String,
      default: null,
      select: false
    },
    resetOtpExpires: {
      type: Date,
      default: null,
      select: false
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

// Method to check if account is locked
UserSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

export default mongoose.model<IUser>('User', UserSchema);
