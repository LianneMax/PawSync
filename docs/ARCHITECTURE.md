# PawSync Database Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐          │
│  │   Sign Up Page       │      │    Login Page        │          │
│  │  (signup/page.tsx)   │      │  (login/page.tsx)    │          │
│  └──────────┬───────────┘      └──────────┬───────────┘          │
│             │                             │                      │
│             └─────────────┬───────────────┘                      │
│                           │                                       │
│                    ┌──────▼──────┐                               │
│                    │ lib/auth.ts  │                               │
│                    │  (API calls) │                               │
│                    └──────┬───────┘                               │
│                           │                                       │
│                    ┌──────▼──────────────┐                       │
│                    │ store/authStore.ts  │                       │
│                    │ (Zustand + Storage) │                       │
│                    └──────────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/CORS
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                       SERVER SIDE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Express Server (Port 5000)                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │         API Routes (/api/auth/*)                    │  │  │
│  │  │  • POST /register  → authController.register()      │  │  │
│  │  │  • POST /login     → authController.login()         │  │  │
│  │  │  • GET  /me        → authController.getCurrentUser()│  │  │
│  │  │  • POST /logout    → authController.logout()        │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                          │                                  │  │
│  │                          ▼                                  │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │         Middleware Stack                            │  │  │
│  │  │  • helmet() - Security headers                      │  │  │
│  │  │  • cors() - Cross-origin requests                  │  │  │
│  │  │  • express.json() - Parse JSON                     │  │  │
│  │  │  • authMiddleware - Verify JWT tokens              │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                          │                                  │  │
│  │                          ▼                                  │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │      controllers/authController.ts                  │  │  │
│  │  │  • Input validation                                 │  │  │
│  │  │  • Business logic                                   │  │  │
│  │  │  • Database queries                                 │  │  │
│  │  │  • JWT token generation                             │  │  │
│  │  │  • Password hashing/verification                    │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                          │                                  │  │
│  │                          ▼                                  │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │         models/User.ts (Mongoose Schema)            │  │  │
│  │  │  • User interface & schema                          │  │  │
│  │  │  • Password hashing hooks                           │  │  │
│  │  │  • Password comparison method                       │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          │                                         │
└──────────────────────────┼─────────────────────────────────────────┘
                           │
                           │ Mongoose/MongoDB Driver
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   MONGODB DATABASE                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Database: pawsync                                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    users Collection                    │ │
│  │ ┌──────────────────────────────────────────────────┐  │ │
│  │ │ Document 1                                       │  │ │
│  │ │ ├── _id: ObjectId                                │  │ │
│  │ │ ├── firstName: "John"                            │  │ │
│  │ │ ├── lastName: "Doe"                              │  │ │
│  │ │ ├── email: "john@example.com"                    │  │ │
│  │ │ ├── password: "$2a$10$..." (hashed)              │  │ │
│  │ │ ├── userType: "pet-owner"                        │  │ │
│  │ │ ├── isVerified: true                             │  │ │
│  │ │ ├── createdAt: 2024-01-23T...                    │  │ │
│  │ │ └── updatedAt: 2024-01-23T...                    │  │ │
│  │ └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │ ┌──────────────────────────────────────────────────┐  │ │
│  │ │ Document 2                                       │  │ │
│  │ │ └── ... (more users)                             │  │ │
│  │ └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### Registration Flow
```
User Signup Form
      │
      ▼
Validate Input (Frontend)
      │
      ▼
POST /api/auth/register
      │
      ├──────────────────────────────────────────┐
      │                                          │
      ▼                                          ▼
Check if email exists                  Validate password strength
      │                                          │
      ├──────────────────────────────────────────┘
      │
      ▼
Hash password with bcryptjs
      │
      ▼
Create User document in MongoDB
      │
      ▼
Generate JWT token
      │
      ▼
Return token + user data
      │
      ▼
Store in localStorage + Zustand
      │
      ▼
Redirect to onboarding
```

### Login Flow
```
User Login Form
      │
      ▼
POST /api/auth/login
      │
      ├──────────────────────────────────────────┐
      │                                          │
      ▼                                          ▼
Find user by email                    Check if password matches
      │                                 (bcryptjs.compare)
      │                                          │
      ├──────────────────────────────────────────┘
      │
      ├─── Invalid? ──▶ Return 401 Unauthorized
      │
      ▼
Generate JWT token
      │
      ▼
Return token + user data
      │
      ▼
Store in localStorage + Zustand
      │
      ▼
Redirect to dashboard
```

### Protected Request Flow
```
Authenticated Request
      │
      ├──────────────────────────────────────────────┐
      │                                              │
      ▼                                              ▼
Add JWT token to Authorization header   Request: GET /api/auth/me
      │                                              │
      └──────────────────────────────────────────────┘
                         │
                         ▼
                 authMiddleware
                         │
          ┌──────────────┴──────────────┐
          │                             │
    Token valid?                  Token invalid?
          │                             │
          ▼                             ▼
  Extract user info          Return 401 Unauthorized
          │
          ▼
  Attach to req.user
          │
          ▼
  Call route handler
          │
          ▼
  Return protected data
```

## Data Flow Example: User Registration

```
┌─────────────────────────────────────────────────────────────────┐
│ Client (React/Next.js)                                          │
│                                                                  │
│  User fills form:                                               │
│  • firstName: "John"                                            │
│  • lastName: "Doe"                                              │
│  • email: "john@example.com"                                    │
│  • password: "password123" (never sent unencrypted in prod)    │
│  • userType: "pet-owner"                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    POST request with HTTPS
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ Server (Express)                                                │
│                                                                  │
│  authController.register():                                     │
│  1. Validate all fields present                                │
│  2. Validate email format                                       │
│  3. Validate password length >= 6                               │
│  4. Check passwords match                                       │
│  5. Check email not already in DB                               │
│                                                                  │
│  If validation fails → Send 400 error                          │
│  If OK → Continue...                                            │
│                                                                  │
│  6. Hash password: bcryptjs.hash(password, salt=10)             │
│     Result: "$2a$10$..." (irreversible)                         │
│  7. Create user document                                        │
│  8. Save to MongoDB                                             │
│  9. Generate JWT: jwt.sign({userId, email, userType}, secret)  │
│     Result: "eyJhbGc..." (expires in 7 days)                   │
│  10. Return {user, token}                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    JSON response
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ Client (React/Next.js)                                          │
│                                                                  │
│  1. Receive {user, token}                                       │
│  2. Store token in localStorage                                │
│  3. Store user in Zustand authStore                            │
│  4. Set Authorization header for future requests               │
│  5. Redirect to /onboarding/pet-profile                        │
│                                                                  │
│  Future requests now include:                                  │
│  Header: Authorization: Bearer eyJhbGc...                      │
└──────────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: HTTPS/TLS (Transport)                      │
│ - Encrypts data in transit                          │
│ - Prevents man-in-the-middle attacks                │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 2: Input Validation                           │
│ - Checks email format                               │
│ - Validates password strength                       │
│ - Prevents SQL injection, XSS                       │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 3: Password Hashing                           │
│ - bcryptjs with salt rounds                         │
│ - One-way function (cannot reverse)                 │
│ - Brute-force resistant                             │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 4: JWT Tokens                                 │
│ - Signed with secret key                            │
│ - Expires after 7 days                              │
│ - Cannot be forged without secret                   │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 5: CORS                                       │
│ - Restricts cross-origin requests                   │
│ - Only frontend domain allowed                      │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 6: Helmet.js                                  │
│ - Security headers (CSP, X-Frame-Options, etc)     │
└─────────────────────────────────────────────────────┘
```

## State Management Flow

```
┌──────────────────────────────────────────────────────────┐
│                   Zustand Auth Store                      │
│  (Global state + persisted to localStorage)              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  State:                                                  │
│  ├── user: { id, email, name, userType, isVerified }   │
│  ├── token: string (JWT)                                │
│  ├── isLoading: boolean                                  │
│  ├── error: string | null                                │
│  └── isAuthenticated(): boolean                          │
│                                                           │
│  Actions:                                                │
│  ├── login(user, token) - Called after successful auth   │
│  ├── logout() - Clears user and token                    │
│  ├── setUser(user) - Update user data                    │
│  ├── setToken(token) - Update token                      │
│  ├── setLoading(boolean) - Loading state                 │
│  └── setError(string) - Error handling                   │
│                                                           │
│  Persistence:                                            │
│  └── Saved to localStorage as 'auth-store'               │
│      └── Automatically restored on page refresh          │
│                                                           │
└──────────────────────────────────────────────────────────┘
             │                              │
             ▼                              ▼
      Components can subscribe       Survives page refresh
      to state changes               (user stays logged in)
```

## Database Schema

```
┌────────────────────────────────────────────────────────────┐
│                     users Collection                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Fields:                                                    │
│                                                             │
│  _id             ObjectId      (Auto-generated)            │
│                                                             │
│  firstName       String         "John"                     │
│  lastName        String         "Doe"                      │
│                                                             │
│  email           String         "john@example.com"         │
│                  (unique)       (enforced at DB level)     │
│                  (indexed)      (for fast lookups)         │
│                  (lowercase)    (case-insensitive)         │
│                                                             │
│  password        String         "$2a$10$..." (hashed)     │
│                  (selected=false) (not returned by default) │
│                  (required)                                 │
│                  (minlength=6)                              │
│                                                             │
│  userType        Enum           "pet-owner" or             │
│                                 "veterinarian"             │
│                                                             │
│  isVerified      Boolean        true (pet-owner)           │
│                                 false (vet pending)        │
│                                                             │
│  createdAt       Date           2024-01-23T12:00:00Z       │
│  (Auto-timestamp)                                          │
│                                                             │
│  updatedAt       Date           2024-01-23T12:00:00Z       │
│  (Auto-timestamp)                                          │
│                                                             │
└────────────────────────────────────────────────────────────┘

Indexes:
├── _id (primary)
└── email (unique)

Relationships (future):
├── pets (one user → many pets)
├── appointments (one vet → many appointments)
└── medical_records (one pet → many records)
```

## Environment Configuration

```
Backend .env
├── PORT = 5000
├── NODE_ENV = development
├── MONGODB_URI = mongodb://localhost:27017/pawsync
├── JWT_SECRET = "change-this-to-random-32-chars"
├── JWT_EXPIRE = 7d
├── FRONTEND_URL = http://localhost:3000
└── (Optional) API keys for services

Frontend .env.local
└── NEXT_PUBLIC_API_URL = http://localhost:5000/api
```

This architecture ensures:
- ✅ Secure password storage
- ✅ Stateless authentication (JWT)
- ✅ Easy scalability
- ✅ CORS protection
- ✅ Input validation
- ✅ Token expiration
- ✅ Role-based access control
