# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Authentik, a full-stack web application built with TypeScript, React, and Express. It's a multi-tenant authentication and form management system with subscription capabilities.

## Common Development Commands

### Development
```bash
npm run dev           # Start development server (runs on port 5173)
```

### Build & Production
```bash
npm run build         # Build client (Vite) and server (esbuild)
npm run start         # Run production server
```

### Database Management
```bash
npm run db:push       # Push schema changes to database
npm run db:init       # Initialize database with schema
```

### Type Checking
```bash
npm run check         # Run TypeScript type checking
```

### User Management
```bash
npm run user:set-owner  # Update user role to owner
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with TypeScript, Redux Toolkit (auth state), React Query (server state)
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with session management, 2FA support
- **Payments**: Stripe integration for subscriptions
- **Email**: Resend for transactional emails
- **Build Tools**: Vite (frontend), esbuild (backend)

### Directory Structure
```
├── client/              # Frontend React application
│   └── src/
│       ├── components/  # React components (AppLayout, form-builder, ui/)
│       ├── hooks/       # Custom React hooks
│       ├── pages/       # Route components
│       ├── store/       # Redux store configuration
│       └── lib/         # Utilities and configurations
├── server/              # Backend Express application
│   ├── index.ts        # Main server entry point
│   ├── routes.ts       # API route definitions
│   ├── db.ts           # Database connection
│   └── storage.ts      # Session and data storage
├── shared/              # Shared types and schemas
│   └── schema.ts       # Drizzle ORM schema definitions
└── migrations/          # Database migrations
```

### Key Architectural Patterns

1. **Multi-Tenancy**: Each tenant has isolated data with slug-based identification
2. **Authentication Flow**: 
   - JWT tokens with Redis/in-memory session storage
   - Email verification required
   - 2FA support with TOTP
   - Remember me functionality with extended token duration
3. **State Management**:
   - Redux for auth state (persisted)
   - React Query for server state
   - Session sync between Redux and server
4. **Form Builder**: Drag-and-drop form builder with theming support
5. **API Structure**: RESTful API with `/api` prefix

### Database Schema

Key tables:
- `tenants`: Multi-tenant organizations
- `users`: User accounts with roles (Owner, Administrator, Manager, Employee)
- `forms`: Form definitions with JSON schema
- `formResponses`: Form submission data
- `sessions`: User sessions with device tracking
- `subscriptionPlans`: Stripe subscription plans

### Authentication & Security

- Password hashing with bcrypt
- JWT tokens for authentication
- Session management with device tracking
- Email verification flow
- 2FA with QR code generation
- Role-based access control

### Important Configuration

- Environment variables loaded from `.env` file
- Database connection via `DATABASE_URL`
- Stripe keys for payment processing
- Resend API key for emails
- JWT secret for token signing

### Development Notes

- TypeScript strict mode enabled
- Path aliases configured: `@/` for client src, `@shared/` for shared code
- React components use a mix of Radix UI and Headless UI
- Tailwind CSS for styling with custom animations
- Form validation with Zod schemas
- PM2 process management: DO NOT restart the Authentik process during development as file watching is enabled

### UI/UX Guidelines

#### Menu Collapse Behavior
- The sidebar menu collapse is ONLY controlled through the user profile page settings
- There is NO burger menu or collapse button in the dashboard sidebar
- Menu preference is stored in both localStorage and synced with backend user preferences
- The menu state persists across sessions and is user-specific