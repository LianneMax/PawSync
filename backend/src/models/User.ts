import mongoose, { Schema, Document } from 'mongoose';
import bcryptjs from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  contactNumberNormalized?: string | null;
  photo?: string;
  userType: 'pet-owner' | 'veterinarian' | 'clinic-admin' | 'inactive';
  inviteStatus?: 'invited' | 'resent' | 'activated' | null;
  isGuest?: boolean;
  claimStatus?: 'unclaimed' | 'unclaimable' | 'invited' | 'claimed' | null;
  guestClinicId?: mongoose.Types.ObjectId | null;
  claimToken?: string | null;
  claimTokenExpires?: Date | null;
  claimInviteSentAt?: Date | null;
  resignation?: {
    status: 'none' | 'pending' | 'approved' | 'rejected' | 'completed';
    submittedAt: Date | null;
    noticeStart: Date | null;
    endDate: Date | null;
    backupVetId: mongoose.Types.ObjectId | null;
    clinicId: mongoose.Types.ObjectId | null;
    clinicBranchId: mongoose.Types.ObjectId | null;
    rejectionReason: string | null;
  };
  clinicId: mongoose.Types.ObjectId | null;
  clinicBranchId: mongoose.Types.ObjectId | null;
  isMainBranch: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  googleId?: string;
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
      required: false,   // Guest users may use a placeholder; non-guests validated at application level
      unique: true,
      sparse: true,      // Allows multiple null values (future-proof; guests always get a placeholder)
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
      index: true
    },
    password: {
      type: String,
      required: false, // Not required for Google OAuth users
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
    contactNumberNormalized: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
      index: true
    },
    userType: {
      type: String,
      enum: ['pet-owner', 'veterinarian', 'clinic-admin', 'inactive'],
      required: [true, 'Please specify user type']
    },
    resignation: {
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected', 'completed'],
        default: 'none'
      },
      submittedAt: {
        type: Date,
        default: null
      },
      noticeStart: {
        type: Date,
        default: null
      },
      endDate: {
        type: Date,
        default: null
      },
      backupVetId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
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
      rejectionReason: {
        type: String,
        default: null
      }
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
    isMainBranch: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false // For veterinarians, this tracks PRC license verification
    },
    photo: {
      type: String,
      default: null
    },
    googleId: {
      type: String,
      default: null,
      sparse: true // Allow multiple null values (only unique when non-null)
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: true // true so existing users aren't locked out; register() sets it to false explicitly
    },
    emailVerificationToken: {
      type: String,
      default: null,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false
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
    },
    // ── Pet owner onboarding invite status ────────────────────────────────────
    // Tracks where a clinic-created pet owner is in the activation flow.
    // 'expired' is NOT stored here — it is derived at read time from
    // emailVerificationExpires < now && emailVerified === false.
    inviteStatus: {
      type: String,
      enum: ['invited', 'resent', 'activated', null],
      default: null,
    },

    // ── Guest / Walk-in intake fields ─────────────────────────────────────────
    isGuest: {
      type: Boolean,
      default: false,
      index: true
    },
    claimStatus: {
      type: String,
      enum: ['unclaimed', 'unclaimable', 'invited', 'claimed', null],
      default: null
    },
    guestClinicId: {
      type: Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null
    },
    claimToken: {
      type: String,
      default: null,
      select: false
    },
    claimTokenExpires: {
      type: Date,
      default: null,
      select: false
    },
    claimInviteSentAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (this: IUser) {
  if (this.isModified('contactNumber')) {
    const normalizedContact = (this.contactNumber || '').replace(/\D/g, '');
    this.contactNumber = normalizedContact || null as any;
    this.contactNumberNormalized = normalizedContact || null as any;
  }

  // Only hash password if it's new or modified
  if (!this.isModified('password')) {
    return;
  }

  // Skip if no password set (Google OAuth users)
  if (!this.password) {
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
  if (!this.password) return false; // Google-only accounts have no password
  return await bcryptjs.compare(password, this.password);
};

// Method to check if account is locked
UserSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

export default mongoose.model<IUser>('User', UserSchema);
