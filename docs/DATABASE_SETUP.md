# Database Implementation Guide for PawSync

## Overview
This guide walks you through setting up the database backend for user authentication and subsequent data persistence for your PawSync application.

## What Has Been Implemented

### Backend (Node.js + Express + MongoDB + Mongoose)

1. **User Model** (`/backend/src/models/User.ts`)
   - Stores user credentials and profile information
   - Supports two user types: `pet-owner` and `veterinarian`
   - Passwords are automatically hashed using bcryptjs
   - Includes verification status for veterinarians

2. **Authentication Controller** (`/backend/src/controllers/authController.ts`)
   - `register()` - Creates new users
   - `login()` - Authenticates existing users
   - `getCurrentUser()` - Retrieves user profile
   - `logout()` - Handles logout (frontend removes token)

3. **Authentication Routes** (`/backend/src/routes/authRoutes.ts`)
   - POST `/api/auth/register` - User registration
   - POST `/api/auth/login` - User login
   - GET `/api/auth/me` - Get current user (protected)
   - POST `/api/auth/logout` - Logout

4. **Auth Middleware** (`/backend/src/middleware/auth.ts`)
   - `authMiddleware` - Verifies JWT tokens
   - `veterinarianOnly` - Restricts endpoints to veterinarians
   - `petOwnerOnly` - Restricts endpoints to pet owners

### Frontend (Next.js + React)

1. **Auth API Utilities** (`/frontend/lib/auth.ts`)
   - `register()` - Call backend registration
   - `login()` - Call backend login
   - `getCurrentUser()` - Fetch user profile
   - `logout()` - Call logout endpoint
   - `authenticatedFetch()` - Helper for authenticated requests

2. **Auth Store** (`/frontend/store/authStore.ts`)
   - Zustand store for global auth state
   - Persists auth data to localStorage
   - Manages user, token, loading, and error states

3. **Updated Pages**
   - `SignUp Page` - Integrated with backend registration
   - `Login Page` - Integrated with backend login

## Setup Instructions

### Step 1: Install MongoDB

**Option A: Local MongoDB (macOS)**
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster
4. Copy the connection string

### Step 2: Configure Environment Variables

**Backend Setup:**
```bash
cd backend
cp .env.example .env
```

Edit `/backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/pawsync
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

**Frontend Setup:**
Create `/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Step 3: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Step 4: Start the Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server will run on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend will run on http://localhost:3000
```

## How It Works

### Registration Flow
1. User fills signup form and selects user type (pet-owner or veterinarian)
2. Frontend calls `register()` from `/lib/auth.ts`
3. Backend validates input and checks for duplicate email
4. Password is hashed with bcryptjs
5. User document is created in MongoDB
6. JWT token is generated and returned
7. Frontend stores token in localStorage and Zustand store
8. User is redirected to onboarding based on user type

### Login Flow
1. User enters email and password
2. Frontend calls `login()` from `/lib/auth.ts`
3. Backend finds user by email and compares password hash
4. JWT token is generated if credentials are valid
5. Frontend stores token and user data
6. User is redirected to dashboard/onboarding

### Authentication on Protected Routes
1. Frontend includes JWT token in Authorization header
2. Backend middleware verifies token signature and expiration
3. User information is attached to request
4. Route handler processes authenticated request

## API Endpoints Reference

### Public Endpoints (No Auth Required)

**Register User**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "userType": "pet-owner"
}

Response:
{
  "status": "SUCCESS",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "userType": "pet-owner",
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Login**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "status": "SUCCESS",
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Protected Endpoints (Auth Required)

**Get Current User**
```bash
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
{
  "status": "SUCCESS",
  "data": {
    "user": { ... }
  }
}
```

**Logout**
```bash
POST /api/auth/logout

Response:
{
  "status": "SUCCESS",
  "message": "Logout successful. Please remove the token from your client."
}
```

## Next Steps

### 1. Create Additional Models

You'll want to create models for:
- **Pet** - Pet profiles with name, breed, age, etc.
- **MedicalRecord** - Health records, vaccinations, etc.
- **Appointment** - Vet appointments
- **VeterinarianProfile** - Extra vet info (clinic, PRC license, etc.)

Example Pet Model:
```typescript
// /backend/src/models/Pet.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPet extends Document {
  ownerId: string;
  name: string;
  species: string;
  breed: string;
  dateOfBirth: Date;
  weight: number;
  microchipId?: string;
  createdAt: Date;
}

const PetSchema = new Schema({
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: String,
  species: String,
  breed: String,
  dateOfBirth: Date,
  weight: Number,
  microchipId: String
}, { timestamps: true });

export default mongoose.model<IPet>('Pet', PetSchema);
```

### 2. Create Additional Routes
- Pet routes for CRUD operations
- Medical record routes
- Appointment routes

### 3. Add Role-Based Access Control
Use the `veterinarianOnly` and `petOwnerOnly` middleware for protected routes.

### 4. Add Data Validation
Use `express-validator` for input validation (already in dependencies).

### 5. Implement Veterinarian Verification
- Store PRC license info in database
- Create verification workflow
- Update `isVerified` status after approval

## Testing

### Using cURL

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "password": "test123",
    "confirmPassword": "test123",
    "userType": "pet-owner"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "test123"
  }'

# Get current user (replace TOKEN)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### Using Postman or Insomnia
1. Import the API endpoints
2. Test registration with different user types
3. Test login with valid/invalid credentials
4. Test protected endpoints with/without token

## Troubleshooting

**"MONGODB_URI is not defined"**
- Make sure `.env` file exists in `/backend` directory
- Verify `MONGODB_URI` is set correctly

**"Invalid email or password"**
- Passwords are case-sensitive
- Check email spelling
- Make sure user exists in database

**"Invalid or expired token"**
- Token may have expired (7 days by default)
- User needs to login again
- Check token format in Authorization header

**CORS errors**
- Verify `FRONTEND_URL` in backend `.env`
- Check frontend is running on correct port
- Ensure `credentials: true` is set in axios/fetch requests

## Security Notes

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use strong JWT_SECRET** - Minimum 32 characters in production
3. **Enable HTTPS** - Use HTTPS in production
4. **Validate input** - Both frontend and backend should validate
5. **Hash passwords** - Already handled by bcryptjs middleware
6. **Secure tokens** - Store in httpOnly cookies (future improvement)
7. **Rate limiting** - Use `express-rate-limit` for login/register endpoints

## Database Schema

```
Users Collection:
├── _id: ObjectId
├── firstName: String
├── lastName: String
├── email: String (unique)
├── password: String (hashed)
├── userType: enum['pet-owner', 'veterinarian']
├── isVerified: Boolean
├── createdAt: Date
└── updatedAt: Date
```

## Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT.io](https://jwt.io/)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [Express Authentication](https://expressjs.com/en/advanced/best-practice-security.html)
