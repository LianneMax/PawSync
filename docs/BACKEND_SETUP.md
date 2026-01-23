# Backend Setup Guide

## Environment Variables

Create a `.env` file in the `/backend` directory with the following variables:

```
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/pawsync
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pawsync

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRE=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email Service (optional, for notifications)
RESEND_API_KEY=your-resend-api-key

# OpenAI (optional, for AI features)
OPENAI_API_KEY=your-openai-api-key
```

## Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up MongoDB

**Option A: Local MongoDB**
- Install MongoDB from https://docs.mongodb.com/manual/installation/
- Start MongoDB service
- Default connection: `mongodb://localhost:27017/pawsync`

**Option B: MongoDB Atlas (Cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster
4. Get connection string and add to `.env` as `MONGODB_URI`

### 3. Start Development Server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication Endpoints

**Register**
- POST `/api/auth/register`
- Body:
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "userType": "pet-owner" // or "veterinarian"
  }
  ```
- Response: JWT token + user data

**Login**
- POST `/api/auth/login`
- Body:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- Response: JWT token + user data

**Get Current User**
- GET `/api/auth/me`
- Headers: `Authorization: Bearer <token>`
- Response: Current user profile

**Logout**
- POST `/api/auth/logout`
- Response: Success message

## Using JWT Tokens

All authenticated endpoints require the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing with cURL

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "userType": "pet-owner"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get current user (replace TOKEN with actual token)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Database Collections

Once you create a user, MongoDB will automatically create:
- `users` collection - stores user accounts with hashed passwords

## Next Steps

1. Update frontend to call auth endpoints (see frontend API setup)
2. Create Pet model for pet profiles
3. Create additional models as per ERD
4. Implement role-based access control
