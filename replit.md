# Nomad Internet Customer Portal

## Overview
A customer portal for Nomad Internet customers with sign-in and sign-up functionality. The portal uses official Nomad Internet branding with a modern SaaS-style design. Features full authentication with OTP verification, PostgreSQL database for customer storage, and activity tracking.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Routing**: React Router DOM
- **Build Tool**: Vite
- **Auth**: JWT-based sessions with bcrypt password hashing

## Design System
- **Primary Color**: #10a37f (brand green)
- **Accent Color**: #0a8f6a (deep green)
- **Background**: #f7faf9 (light mint)
- **Text**: #0f172a (slate-900)
- **Muted**: #64748b (slate-500)
- **Font**: Inter (system fonts fallback)
- **Logo**: Nomad Internet official logo

### Key Design Elements
- Glassmorphism card with backdrop blur
- Gradient left panel with layered radial gradients
- 34px bold titles (800 weight)
- 52px tall inputs with subtle focus rings
- 54px gradient buttons with shadows
- Stats section with border-top styling

## Project Structure
```
src/
├── components/
│   ├── AuthLayout.tsx    # Two-column layout with glassmorphism card
│   ├── Button.tsx        # Gradient button with hover animations
│   └── Input.tsx         # Tall styled input with tooltips
├── pages/
│   ├── SignIn.tsx        # Sign-in page (password or OTP)
│   ├── SignUp.tsx        # Multi-step sign-up flow
│   ├── ForgotPassword.tsx # Password reset flow
│   ├── Dashboard.tsx     # User dashboard with profile dropdown
│   ├── AccountSettings.tsx # Update name, password, phone
│   └── ActivityLog.tsx   # Login history and activity
├── App.tsx               # Router configuration
├── main.tsx              # App entry point
└── index.css             # Global styles + design tokens

server/
├── index.ts              # Express API endpoints
├── storage.ts            # Database storage layer
└── db.ts                 # Drizzle database connection

shared/
└── schema.ts             # Database schema (customers, otp_codes, sessions)
```

## Database Schema
- **customers**: email, phone, password hash, verification status, Chargebee ID, login tracking
- **otp_codes**: 6-digit codes with 10-minute expiration, types (phone/email/signin)
- **sessions**: JWT tokens with 7-day expiration

## Sign-Up Flow
1. **Email Step**: User enters email, checked against local database first
   - If user exists with password, shows message to sign in instead with links to Sign In and Forgot Password
   - If not in local DB, checks against Chargebee API
2. **Confirm Email**: If not found in Chargebee, asks user to confirm or try different email
3. **Phone Step**: Collects US phone number (+1 format with validation)
4. **Phone OTP**: Backend generates 6-digit OTP, sends via Twilio, user enters code
5. **Email OTP**: Backend generates 6-digit OTP, sends via Twilio, user enters code
6. **Full Name + Password**: User enters full name and creates password (min 8 characters)
7. **Auto-login**: User is automatically logged in and redirected to dashboard

## Sign-In Methods
1. **Password**: Traditional email + password authentication
2. **OTP (Passwordless)**: Email OTP sent, verified, then logged in

## Forgot Password Flow
1. **Email Step**: User enters email, OTP sent with indicator "Email OTP forgot password"
2. **Verify OTP**: User enters 6-digit code, server issues secure reset token (15-min expiry)
3. **Reset Password**: User creates new password, reset token validated and invalidated after use
4. **Success**: User redirected to sign in with new password

## Backend API Endpoints
- `POST /api/auth/check-email` - Verify email against Chargebee
- `POST /api/auth/check-existing-user` - Check if email exists in local database
- `POST /api/auth/send-phone-otp` - Generate and send phone OTP
- `POST /api/auth/verify-phone-otp` - Verify phone OTP code
- `POST /api/auth/send-email-otp` - Generate and send email OTP
- `POST /api/auth/verify-email-only` - Verify email OTP (sign-up)
- `POST /api/auth/complete-signup` - Set password, full name, and complete registration
- `POST /api/auth/signin` - Password-based sign in
- `POST /api/auth/signin-otp` - Request OTP for sign in
- `POST /api/auth/verify-signin-otp` - Verify OTP and sign in
- `POST /api/auth/forgot-password` - Send OTP for password reset
- `POST /api/auth/verify-forgot-password-otp` - Verify OTP and issue reset token
- `POST /api/auth/reset-password` - Reset password with valid reset token
- `POST /api/auth/update-name` - Update user's full name
- `POST /api/auth/update-password` - Change password (requires current password)
- `POST /api/auth/request-phone-change` - Send OTP to verify new phone number
- `POST /api/auth/verify-phone-change` - Verify OTP and update phone number
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Invalidate session

## External API Endpoints
- Chargebee API (direct) - `https://{CHARGEBEE_SITE}.chargebee.com/api/v2/` - Customer, subscription, invoice, transaction lookup
- `POST https://app.lrlos.com/webhook/twilio/sendotp` - Send OTP codes
- Shopify Admin API - Order retrieval
- Shipstation API - Shipping and tracking information
- ThingSpace API - Device status and management

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `JWT_SECRET` - Secret key for JWT token signing (required)

## Running the App
```bash
npm run dev      # Frontend on port 5000
npm run server   # Backend on port 3001
npm run db:push  # Push database schema
```

## Recent Changes
- Jan 24, 2026: Full authentication implementation
  - PostgreSQL database with customers, OTP codes, and sessions tables
  - Express backend with OTP generation, verification, and auth endpoints
  - Sign-up flow with phone and email OTP verification
  - Sign-in with password or OTP-based authentication
  - Dashboard with account info and activity tracking (last login, login count)
  - JWT-based session management with 7-day tokens
  - Secure email OTP verification before password creation
- Jan 24, 2026: Forgot Password and existing user detection
  - Check existing user endpoint to detect registered users during signup
  - Show links to Sign In and Forgot Password for existing users
  - Forgot Password flow with OTP verification (indicator: "Email OTP forgot password")
  - Secure reset token system (15-min expiry, single-use, invalidated on new OTP request)
  - Full name collection during signup and display on dashboard
- Jan 24, 2026: Account Settings and Activity Log
  - Profile avatar with dropdown menu (Account Settings, Activity Log, Sign Out)
  - Account Settings page to update full name, password, and phone number
  - Phone number change requires OTP verification and checks for duplicate numbers
  - Activity Log page with login statistics and account history
  - Removed Activity section from main dashboard (moved to Activity Log page)
- Jan 28, 2026: Comprehensive Customer Data Integration
  - Unified service layer (server/services.ts) fetching data from Chargebee, Shopify, Shipstation, ThingSpace
  - New /api/customer/full-data endpoint aggregating all customer information
  - Enhanced Dashboard with 5 tabs: Overview, Subscriptions, Orders, Invoices, Devices
  - Combined Shopify + Shipstation orders with unified tracking information
  - Subscriptions display ICCID/IMEI/MDN from Chargebee custom fields
  - ThingSpace integration for device status lookup by ICCID
  - Expandable "Raw Data" panels on all sections to show complete JSON payloads
- Jan 28, 2026: Chargebee Multi-Customer Hierarchy Support
  - Restructured ChargebeeData to support: one email → multiple customers → multiple subscriptions per customer
  - Dashboard Subscriptions tab shows hierarchical view with customer account headers (when multiple exist)
  - Added totalSubscriptions, totalInvoices, totalDue aggregation across all customers
  - Helper arrays (allSubscriptions, allInvoices, allTransactions) for flattened data access
  - IMEI/ICCID display in Orders section from Shipstation advancedOptions.customField1/2
  - Optimized API calls: Shopify orders by email parameter, Shipstation orders by order numbers
