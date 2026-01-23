# PawSync Database Implementation - Quick Start

## What's Been Set Up

You now have a complete user authentication system with:
- ✅ User registration and login
- ✅ Password hashing with bcryptjs
- ✅ JWT-based authentication
- ✅ Role-based access (pet-owner vs veterinarian)
- ✅ Protected API endpoints
- ✅ Frontend integration with Zustand state management

## Files Created/Modified

### Backend Files
```
/backend/src/
├── models/User.ts              ← User schema with auth
├── controllers/authController.ts ← Auth logic
├── routes/authRoutes.ts        ← Auth endpoints
├── middleware/auth.ts          ← Auth middleware
└── server.ts (updated)         ← Integrated auth routes

/backend/.env.example           ← Environment template
/backend/src/server.ts (updated)← Added auth routes
```

### Frontend Files
```
/frontend/
├── lib/auth.ts                 ← API utilities
├── store/authStore.ts          ← Zustand store
├── app/signup/page.tsx (updated) ← Backend integration
└── app/login/page.tsx (updated)  ← Backend integration
```

### Documentation
```
/DATABASE_SETUP.md              ← Complete guide
/BACKEND_SETUP.md              ← Environment & endpoints
```

## Getting Started (5 Minutes)

### 1. Setup MongoDB
```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### 2. Configure Backend Environment
```bash
cd /Users/alyssa/Documents/GitHub/PawSync/backend
cp .env.example .env
```
Edit `.env` and ensure:
```env
MONGODB_URI=mongodb://localhost:27017/pawsync
JWT_SECRET=your-secure-random-string
```

### 3. Start Servers
```bash
# Terminal 1 - Backend
cd /Users/alyssa/Documents/GitHub/PawSync/backend
npm run dev

# Terminal 2 - Frontend
cd /Users/alyssa/Documents/GitHub/PawSync/frontend
npm run dev
```

### 4. Test the Flow
1. Go to http://localhost:3000/signup
2. Fill in the form with any user type
3. User is registered, token is saved, and redirected to onboarding
4. Go to http://localhost:3000/login
5. Login with the same credentials

## How Authentication Works

### When User Signs Up
1. Frontend sends: `firstName, lastName, email, password, userType`
2. Backend validates and hashes password
3. User document created in MongoDB
4. JWT token generated and returned
5. Frontend stores token in localStorage
6. Zustand store updated with user data

### When User Logs In
1. Frontend sends: `email, password`
2. Backend finds user and verifies password
3. JWT token generated if valid
4. Frontend stores token and user data
5. Protected routes now accessible

### Making Authenticated Requests
```typescript
// Uses stored token automatically
const response = await authenticatedFetch('/api/protected-endpoint');
```

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/register` | POST | No | Create new account |
| `/api/auth/login` | POST | No | Login to account |
| `/api/auth/me` | GET | Yes | Get current user |
| `/api/auth/logout` | POST | No | Logout (frontend clears token) |

## User Types

- **pet-owner** - Auto-verified after signup
- **veterinarian** - Requires PRC license verification before full access

## Storage Locations

| Data | Storage | Purpose |
|------|---------|---------|
| User profile | MongoDB | Database persistence |
| Auth token | localStorage | Client-side persistence |
| Auth state | Zustand | In-memory + localStorage |

## Next Steps

### 1. Verify Everything Works
- Test signup flow
- Test login flow
- Check browser DevTools → Application → Local Storage for token

### 2. Create Pet Model
```bash
# You'll want to create:
# - /backend/src/models/Pet.ts
# - /backend/src/controllers/petController.ts
# - /backend/src/routes/petRoutes.ts
```

### 3. Protect Routes
Use middleware on future endpoints:
```typescript
router.get('/api/pets', authMiddleware, getPets);
```

### 4. Test with Curl
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@test.com","password":"test123","confirmPassword":"test123","userType":"pet-owner"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"test123"}'
```

## Troubleshooting

**Backend not starting?**
- Check MongoDB is running: `brew services list`
- Check `.env` file exists with correct `MONGODB_URI`
- Check port 5000 is not in use: `lsof -i :5000`

**Frontend can't connect to backend?**
- Ensure backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` environment variable
- Check CORS is enabled (already configured)

**Password validation fails?**
- Password must be 6+ characters
- Passwords must match

**Token errors on protected routes?**
- Token may be expired (regenerate by logging in again)
- Ensure token is in Authorization header: `Bearer <token>`

## Security Reminders

1. ⚠️ Change `JWT_SECRET` in production
2. ⚠️ Never commit `.env` files
3. ⚠️ Use HTTPS in production
4. ⚠️ Implement rate limiting on auth endpoints
5. ⚠️ Consider httpOnly cookies for token storage (future improvement)

## File Structure Summary

```
PawSync/
├── backend/
│   ├── src/
│   │   ├── models/User.ts ← Database schema
│   │   ├── controllers/authController.ts ← Business logic
│   │   ├── routes/authRoutes.ts ← API endpoints
│   │   ├── middleware/auth.ts ← Token verification
│   │   └── server.ts ← Express app
│   ├── .env.example ← Config template
│   └── package.json ← Dependencies
│
├── frontend/
│   ├── lib/auth.ts ← API client
│   ├── store/authStore.ts ← Global state
│   ├── app/signup/page.tsx ← Signup form
│   ├── app/login/page.tsx ← Login form
│   └── package.json ← Dependencies
│
├── DATABASE_SETUP.md ← Full documentation
└── BACKEND_SETUP.md ← Quick reference
```

## Key Technologies

- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Express** - Web framework
- **JWT** - Token-based auth
- **bcryptjs** - Password hashing
- **Zustand** - State management
- **Next.js** - React framework

---

**Status:** ✅ Ready to test and deploy

Start with testing the signup/login flow, then expand with pet models and other features!
