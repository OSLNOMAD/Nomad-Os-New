# Nomad Internet Customer Portal

## Overview
A customer portal for Nomad Internet customers with sign-in and sign-up functionality. The portal uses official Nomad Internet branding with a modern SaaS-style design.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Routing**: React Router DOM
- **Build Tool**: Vite

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
│   ├── SignIn.tsx        # Sign-in page
│   └── SignUp.tsx        # Multi-step sign-up flow
├── App.tsx               # Router configuration
├── main.tsx              # App entry point
└── index.css             # Global styles + design tokens
```

## Sign-Up Flow
1. **Email Step**: User enters email, verified against Chargebee API
2. **Confirm Email**: If not found, asks user to confirm or try different email
3. **Phone Step**: Collects US phone number (+1 format with validation)
4. **Phone OTP**: Sends OTP via Twilio, user enters code
5. **Email OTP**: Sends OTP to email, user enters code

## External API Endpoints
- `POST https://app.lrlos.com/webhook/Chargebee/getcustomersusingemail` - Customer lookup
- `POST https://app.lrlos.com/webhook/twilio/sendotp` - Send OTP codes

## Running the App
```bash
npm run dev
```
Runs on port 5000.

## Recent Changes
- Jan 24, 2026: Complete redesign using SaaS-style CSS reference
  - Updated design tokens (colors, shadows, spacing)
  - Added glassmorphism card wrapper
  - Redesigned inputs (52px height) and buttons (54px, gradient)
  - Bold typography (34px titles, 800 weight)
  - Stats with border-top styling
  - Layered gradient backgrounds
