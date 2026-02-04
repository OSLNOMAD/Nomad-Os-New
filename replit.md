# Nomad Internet Customer Portal

## Overview
The Nomad Internet Customer Portal is a web application designed to provide Nomad Internet customers with a modern, feature-rich platform for managing their services. It includes full authentication, subscription management, order tracking, invoicing, and device management capabilities. The portal aims to enhance the customer experience by offering self-service options and detailed insights into their internet services.

## User Preferences
I prefer detailed explanations, especially for complex features or architectural decisions. I want to be informed before major changes are made to the codebase. I expect iterative development with clear communication at each step.

## System Architecture
The portal is built with a React frontend, an Express.js backend, and a PostgreSQL database utilizing Drizzle ORM. Styling is managed with Tailwind CSS, and animations are handled by Framer Motion. Authentication is JWT-based with bcrypt for password hashing and OTP verification for sign-up and sign-in.

### UI/UX Decisions
The design adheres to official Nomad Internet branding, featuring a modern SaaS aesthetic. Key elements include a glassmorphism card design, gradient panels, Inter font, and a distinct color palette with `#10a37f` as the primary brand green. User interactions are designed with large input fields, gradient buttons, and visual feedback for actions. The dashboard features a tabbed interface for various sections like Overview, Subscriptions, Orders, Invoices, and Internet.

### Technical Implementations
- **Authentication**: Supports traditional email/password and OTP-based passwordless sign-in. The sign-up process includes multi-step verification via phone and email OTP. Password reset is also OTP-verified.
- **Customer Data Aggregation**: A unified service layer integrates data from multiple external APIs (Chargebee, Shopify, Shipstation, ThingSpace) to provide a comprehensive view of customer information, subscriptions, orders, and device statuses.
- **Subscription & Billing**: Displays detailed subscription information, including ICCID/IMEI/MDN. Integrates with Chargebee for invoice viewing, payment collection, and payment method management. Supports subscription-grouped invoices and bulk payment options.
- **Device Management**: The "Internet" tab provides real-time line status indicators from ThingSpace. It supports changing device plans and includes a dedicated troubleshooting page for line restoration with automated recovery attempts and escalation options.
- **AI Chatbot**: An integrated JADA AI chatbot powered by OpenAI GPT-4o provides customer support with contextual awareness of the user's account data.
- **Activity Tracking**: Logs user login history and other account activities.

### Feature Specifications
- **Sign-Up Flow**: Email validation (local DB & Chargebee), phone number collection with OTP, email OTP verification, full name and password creation, auto-login.
- **Sign-In Methods**: Password-based and OTP (passwordless) authentication.
- **Forgot Password Flow**: Email-based OTP verification, secure reset token issuance, new password creation.
- **Account Management**: Users can update their name, password, and phone number (with OTP verification).
- **Dashboard**: Centralized view with tabs for Overview, Subscriptions (hierarchical view for multiple customers), Orders (combined Shopify/Shipstation data), Invoices (with payment options), and Internet (device status, plan changes, troubleshooting).
- **Troubleshooting**: Automated line status checks, suspended line auto-restoration, escalation to support with ticket tracking, and issue-specific guidance for active lines.

## External Dependencies
- **Chargebee**: Billing, subscriptions, invoices, transactions, customer management.
- **Shopify Admin API**: Order retrieval and fulfillment information.
- **Shipstation**: Shipping and tracking details, custom fields for IMEI/ICCID.
- **ThingSpace (Verizon)**: Device management, line status, plan information, device activation/deactivation.
- **Twilio**: Sending OTP codes for phone and email verification.
- **OpenAI GPT-4o**: Powering the JADA AI chatbot.
- **`app.lrlos.com`**: External webhook for sending OTPs and activation requests.

## Recent Changes
- Feb 4, 2026: Cancellation & Retention Flow
  - Multi-step cancellation modal with reason selection (too expensive, slow speeds, not reliable, no longer needed, moving, other)
  - Intelligent flows based on reason: price negotiation for "too expensive", troubleshooting offer for speed/reliability issues
  - Retention offers: 20% off for 2 months or $20 off for 1 month based on target price
  - Contact preference collection (email or phone with callback time)
  - Zendesk ticket creation assigned to "Retention & Cancellations" group (ID: 41909825396372)
  - Slack notification posting with customer details, reason, and ticket ID
  - Database tables: `cancellation_requests` for tracking flow state, `portal_settings` for configuration
  - Admin Dashboard settings tab for updating Slack Channel ID
  - API endpoints: /api/cancellation/* for flow management, /api/admin/settings for portal configuration
- Feb 4, 2026: Customer Feedback Display & Activation Message
  - Customers can now view their submitted feedback and admin responses in the Overview tab
  - Added GET /api/feedback endpoint for customers to fetch their own feedback
  - Feedback section shows feedback type, message, date, and admin response when available
  - Added "Missing a Subscription?" info box in Overview section
  - "Activate Device" button opens activatenomad.com in a new tab
- Feb 4, 2026: Admin Dashboard for Feedback Management
  - New /admin login page for admin users (dark theme, gradient design)
  - Admin dashboard at /admin/dashboard to manage customer feedback
  - View all feedback submissions with filters: All, Pending, Reviewed
  - Respond to feedback with notes, status updates
  - Database: `admin_users` table for admin authentication
  - Extended `customer_feedback` with adminResponse, respondedAt, respondedBy, status fields
  - JWT-based admin authentication with secure password hashing
  - Admin access: bryan@nomadinternet.com (requires seed in development)
  - Seed endpoint protected: development-only with adminSecret required
- Feb 4, 2026: Comprehensive Slow Speed Troubleshooting
  - New guided troubleshooting flow for wireless device slow speeds
  - Qualification questions: When did issue start? Has modem been moved?
  - Controlled line refresh sequence (suspend → 2min → resume → 2min → power cycle)
  - Device & Environment testing guidance with outdoor signal test
  - Database table `slow_speed_sessions` tracks sessions, cooldowns, and results
  - 7-day cooldown between line refreshes, 2-hour sync period after refresh
  - Outdoor test result interpretation: placement vs network capacity
  - Integration with escalation system for unresolved issues
  - API endpoints: POST /api/slow-speed/check-eligibility, start-session, update-session, start-refresh, complete-refresh, GET /api/slow-speed/session/:sessionId
- Feb 3, 2026: Active Line Issue Selection
  - When line is active in troubleshooting, customer selects issue type:
    - "Internet is not working at all" - Shows reboot instructions and support contact
    - "Speed issues" - Now launches comprehensive slow speed troubleshooting flow
- Feb 3, 2026: Device Help Options in Internet Tab
  - "Device Help" dropdown button next to Troubleshoot button (paid services only)
  - Options: Device not powering on, WiFi name not on list, Unable to connect TV, Need replacement power cord, Change WiFi password
  - All options show "Coming Soon" modal when clicked (feature under development)
- Feb 3, 2026: Escalation Tracking System
  - Database table `escalation_tickets` stores ticket ID, customer email, subscription, issue type
  - 24-hour cooldown prevents duplicate escalations
  - Unique ticket IDs (ESC-xxx-xxxx format)
  - API endpoints: POST /api/escalation/check, POST /api/escalation/create
- Feb 3, 2026: Dedicated Troubleshooting Page
  - New /troubleshoot page with automatic line status check on load
  - Suspended line handling: auto-restore via ThingSpace API + 2-minute timer with progress UI
  - Status recheck after 2 minutes: ACTIVE shows issue selection, PENDING_RESUME: 1-minute extended timer
  - "No line found" handling: activation request form with optional alternate email
  - Sends activation request to external webhook (app.lrlos.com)
- Feb 3, 2026: Customer Feedback System
  - Database table `customer_feedback` stores feedback type, message, rating
  - "Submit Feedback" button in bottom left corner (next to chat icon)
  - Modal with feedback type selection: Feature Request, Bug Report, General Feedback, Compliment
  - Encourages customers to request new features and share thoughts
  - API endpoint: POST /api/feedback
- Feb 3, 2026: Device Help Dropdown Fix
  - Fixed dropdown overflow issue - now appears above the button instead of being cut off
  - Changed positioning from `mt-2` (top) to `bottom-full mb-2` (above button)
  - Increased z-index to 50 for proper layering
- Feb 3, 2026: Invoice PDF Download
  - Added download button for each invoice in the Invoices tab
  - Uses Chargebee API endpoint POST /invoices/{id}/pdf to generate download URLs
  - Backend API: GET /api/billing/invoice/:invoiceId/pdf
  - Opens PDF in new browser tab for download
  - Security: Validates invoice belongs to authenticated customer