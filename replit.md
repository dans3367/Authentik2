# Full-Stack SaaS Authentication Application

## Overview
This project is a full-stack SaaS authentication system providing a comprehensive solution for user management. It features JWT token management, user registration, login, profile management, and email verification. The application supports a multi-tenant architecture with Owner-based organization management, allowing each organization its own tenant space and an Owner user to manage team members. The system aims to provide a secure and scalable authentication backbone for SaaS applications, including public form access and email tracking capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.
UI/UX Design: Modern glass morphism design with enhanced dark mode support.

## System Architecture
The application adopts a monorepo architecture, separating client, server, and shared code.

### Core Technologies
-   **Frontend**: React with TypeScript, using Vite.
-   **Backend**: Express.js with TypeScript.
-   **Form Frontend**: Independent React application for public form access (`/fserver`).
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Styling**: Tailwind CSS with shadcn/ui.
-   **State Management**: TanStack Query.
-   **Authentication**: JWT-based with access and refresh tokens, with token invalidation support for "logout all devices".
-   **Email Tracking Microservice**: Go-based server with Temporal integration for robust email tracking.
-   **Resend Webhook Integration**: Real-time email event tracking through webhooks with signature validation for security.

### Key Architectural Decisions
-   **Monorepo Structure**: Facilitates shared types and schemas between frontend and backend.
-   **Multi-Tenant Architecture**: Supports owner-based organization management with row-level security and comprehensive tenant isolation for data across all entities (users, subscriptions, forms, shops, email contacts, newsletters).
-   **JWT Authentication**: Implemented with secure HTTP-only cookies for refresh tokens and comprehensive device session tracking. Token invalidation is handled via a `tokenValidAfter` timestamp for immediate revocation.
-   **Email Verification**: Integrated with Resend for account verification and welcome emails.
-   **Two-Factor Authentication (2FA)**: TOTP-based 2FA with QR code generation.
-   **Robust Data Flow**: Defined processes for owner registration, user login (including 2FA), profile management, and multi-device session handling.
-   **Abstraction Layers**: Storage interface for database operations and custom auth manager for token refresh.
-   **UI/UX**: Utilizes shadcn/ui and Tailwind CSS for a consistent and accessible design, including comprehensive dark mode support, glass morphism design, backdrop blur effects, and gradient-based visual hierarchy.
-   **Form Management**: React Hook Form with Zod validation for robust form handling.
-   **User Management**: Provides administrators with full CRUD operations for users, including role-based access control (Owner, Administrator, Manager, Employee).
-   **Subscription Management**: Interface for managing subscription plans with upgrade/downgrade options and Stripe integration.
-   **Form Server Architecture**: Single-server architecture for the public form frontend, serving both API routes and the React frontend from a single Express server to eliminate CORS issues and simplify deployment.
-   **Newsletter System**: Integrated CRUD interface for newsletter management with preview, statistics, and multi-tenant isolation.
-   **Theme System**: Comprehensive theme support with 16 predefined themes (modern, neon, nature, luxury, glassmorphism, professional, retro, minimal, aurora, cosmic, elegant, playful, brutalist, pastel-dream, neo-modern, modern-bold) ensuring consistent styling across all form displays.
-   **Email Activity Timeline**: Real-time webhook integration with Resend for tracking email lifecycle events (sent, delivered, opened, clicked, bounced, failed, complained, delivery_delayed, scheduled) with comprehensive event storage and visual timeline display in contact management.

## External Dependencies
-   **@neondatabase/serverless**: PostgreSQL database connection.
-   **drizzle-orm**: Type-safe ORM.
-   **@tanstack/react-query**: Server state management.
-   **@radix-ui/***: Accessible UI component primitives.
-   **bcryptjs**: Password hashing.
-   **jsonwebtoken**: JWT token generation and verification.
-   **zod**: Runtime type validation.
-   **Resend**: Email service for verification and communication.
-   **otplib**: For TOTP-based 2FA.
-   **qrcode**: For QR code generation in 2FA.
-   **Stripe**: For subscription and billing management.
-   **wouter**: Lightweight client-side routing.
-   **@headlessui/react**: UI components for forms.
-   **@heroicons/react**: Icons for UI components.
-   **Temporal**: For workflow orchestration in the Go email tracking microservice.

## Email Activity Timeline System

### Overview
The Email Activity Timeline provides comprehensive webhook-based email event tracking for contact management. This system captures and displays real-time email lifecycle events through Resend webhook integration.

### Architecture Components

#### Database Schema
- **email_activity table**: Stores all webhook events with fields for activity type, timestamp, campaign info, and metadata
- **Relations**: Links to email_contacts table for contact-specific activity tracking
- **Data Integrity**: Prevents duplicate webhook processing using webhook_id deduplication

#### API Endpoints
- **GET /api/email-contacts/:contactId/activity**: Retrieves chronological activity timeline for a contact
- **POST /api/webhooks/resend**: Webhook endpoint for receiving Resend email events with signature validation security
- **Multi-tenant Support**: All activities are properly scoped to tenant isolation

#### Webhook Security
- **Signature Validation**: Implements HMAC-SHA256 signature verification using Resend webhook secret
- **Timestamp Verification**: Validates webhook timestamps to prevent replay attacks (5-minute tolerance)
- **Secret Management**: Uses environment variable RESEND_WEBHOOK_SECRET with fallback to hardcoded secret
- **Request Authentication**: Validates resend-signature header format (t=timestamp,v1=signature)

#### Frontend Components
- **EmailActivityTimeline**: React component with visual timeline display
- **Timeline Features**: Color-coded activity types, timestamps, metadata display, and manual refresh capability
- **Integration**: Embedded in contact view page for comprehensive contact insights

### Supported Email Events
- **sent**: Email successfully sent to provider
- **delivered**: Email delivered to recipient inbox
- **opened**: Recipient opened the email (with user agent and IP tracking)
- **clicked**: Recipient clicked links in email (with user agent and IP tracking)
- **bounced**: Email bounced and couldn't be delivered
- **complained**: Recipient marked email as spam
- **unsubscribed**: Recipient unsubscribed from emails

### Webhook Processing
- **Event Mapping**: Converts Resend webhook events to internal activity types
- **Contact Resolution**: Finds contacts across tenants using email address lookup
- **Automatic Updates**: Updates contact statistics (emails opened, status changes)
- **Error Handling**: Comprehensive logging and graceful failure handling

### Implementation Details
- **Real-time Updates**: Activity timeline refreshes automatically using TanStack Query
- **Visual Design**: Timeline layout with activity-specific icons and color coding
- **Debug Features**: Manual refresh button for development and testing
- **Extensible Design**: Architecture supports additional email service providers

### Testing
- **Webhook Simulation**: Test script and curl commands for simulating email events
- **Database Verification**: SQL queries to verify webhook data storage
- **End-to-End**: Complete workflow from webhook receipt to timeline display

## Recent Enhancements

### Email Activity Timeline Date Filtering (August 13, 2025)
- **Date Filter Integration**: Added comprehensive date filtering functionality to email activity timeline
- **Custom Calendar Component**: Built CustomCalendar component with multi-dot activity indicators replacing shadcn Calendar
- **UI/UX Features**: 
  - Date filter button positioned left of refresh button in timeline header
  - Calendar popup with dual-month view for intuitive date range selection
  - Quick preset buttons for common ranges (Last 7 days, Last 30 days)
  - Clear filter option with visual feedback
  - Persistent controls remain visible even when no results are found
- **Activity Indicators**: Color-coded small dots under calendar dates with email activity
  - Red dots: Issues (bounced, complained emails)
  - Green dots: Clicked emails (high engagement)
  - Blue dots: Opened emails
  - Light green dots: Delivered emails
  - Gray dots: Sent emails
  - Orange dots: Unsubscribed emails
  - Activity legend displayed below calendar for user guidance
  - Visual dots appear without bold text styling for clean presentation
- **Backend Support**: Enhanced API endpoint and storage layer to handle date range parameters (from/to dates)
- **Smart Messaging**: Context-aware empty state messages differentiate between no activities vs no activities in selected date range
- **Visual Indicators**: "Filtered" badge and highlighted button state when date filters are active
- **Technical Implementation**: Complete TypeScript compatibility with proper activity type mapping and error handling

### Multi-Provider Email System with Advanced Rate Limiting (August 16, 2025)
- **Multi-Provider Architecture**: Implemented comprehensive email provider management system supporting multiple email services
- **Advanced Rate Limiting**: 
  - Token bucket rate limiter for precise request control (2 requests/second for Resend)
  - Sliding window rate limiter alternative for more granular control
  - Automatic rate limit detection and queue management
- **Intelligent Retry Logic**: 
  - 429 error handling with 5-second delay and retry
  - Maximum 5 retries per email, then hourly retry schedule
  - Exponential backoff with jitter for non-rate-limit errors
  - Provider failover for high availability
- **Email Queue System**: 
  - In-memory queue with automatic processing
  - Batch email support with configurable delays
  - Queue status monitoring and statistics
  - Automatic cleanup of old email records
- **Provider Management**: 
  - Priority-based provider selection
  - Health checks and status monitoring
  - Dynamic provider configuration and registration
  - Resend provider optimized for specific rate limits
- **Monitoring and Observability**: 
  - Real-time email system status endpoints
  - Queue monitoring and statistics
  - Provider health checks and performance metrics
  - Comprehensive logging and error tracking
- **Backward Compatibility**: 
  - Enhanced service with legacy fallback
  - Configurable via environment variables
  - Seamless integration with existing email workflows
- **API Endpoints**: 
  - `/api/email/status` - System status and health
  - `/api/email/queue/status` - Queue monitoring
  - `/api/email/send` - Custom email sending
  - `/api/email/send/batch` - Batch email processing
  - `/api/email/providers` - Provider information

### UUID-Based Newsletter Group Tracking (August 18, 2025)
- **GroupUUID Implementation**: Enhanced newsletter email tracking with unique group identifiers for each newsletter batch
- **Improved Webhook Processing**: 
  - Priority-based tracking system: groupUUID (primary) → newsletter ID (fallback) → subject parsing (last resort)
  - Comprehensive metadata extraction from Resend webhooks including groupUUID and newsletter ID
  - Enhanced debugging and logging for webhook processing with tracking method identification
- **Email Metadata Enhancement**: 
  - All newsletter emails now include groupUUID in both metadata and tags sent to Resend
  - Crypto.randomUUID() generation for unique batch identification per newsletter submission
  - Backward compatibility with existing newsletter ID tracking methods
- **Real-time Engagement Updates**: 
  - Auto-refresh functionality (10-second intervals) for sent newsletters in view page
  - Live engagement metrics updates (opens, clicks, recipient counts) via webhook processing
- **Testing Framework**: 
  - Updated webhook test script with groupUUID simulation capability
  - Comprehensive test scenarios including sent, delivered, opened, clicked, and bounced events
  - Realistic engagement simulation (60% open rate, 33% CTR) for testing newsletter performance tracking
- **Enhanced Logging**: 
  - Detailed webhook processing logs showing groupUUID vs fallback tracking method usage
  - Newsletter engagement tracking confirmation with groupUUID and newsletter ID correlation
  - Improved debugging capabilities for webhook data structure analysis

*Last Updated: August 18, 2025*
```