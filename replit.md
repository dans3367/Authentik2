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
-   **Authentication**: JWT-based with access and refresh tokens.
-   **Email Tracking Microservice**: Go-based server with Temporal integration.

### Key Architectural Decisions
-   **Monorepo Structure**: Facilitates shared types and schemas between frontend and backend.
-   **Multi-Tenant Architecture**: Supports owner-based organization management with row-level security and comprehensive tenant isolation for data across all entities.
-   **JWT Authentication**: Implemented with secure HTTP-only cookies for refresh tokens and token invalidation via a `tokenValidAfter` timestamp.
-   **Email Verification**: Integrated with Resend for account verification and welcome emails.
-   **Two-Factor Authentication (2FA)**: TOTP-based 2FA with QR code generation.
-   **UI/UX**: Utilizes shadcn/ui and Tailwind CSS for a consistent and accessible design, including comprehensive dark mode support, glass morphism design, backdrop blur effects, and gradient-based visual hierarchy.
-   **Form Management**: React Hook Form with Zod validation.
-   **User Management**: Provides administrators with full CRUD operations for users, including role-based access control.
-   **Subscription Management**: Interface for managing subscription plans with upgrade/downgrade options and Stripe integration.
-   **Form Server Architecture**: Single-server architecture for the public form frontend, serving both API routes and the React frontend from a single Express server to eliminate CORS issues and simplify deployment.
-   **Newsletter System**: Integrated CRUD interface for newsletter management with preview, statistics, and multi-tenant isolation.
-   **Puck Visual Editor**: Integrated Puck drag-and-drop page builder for newsletter creation at `/newsletter/create`, featuring 10 customizable components (Button, Card, Grid, Flex, Hero, Heading, Text, Logos, Stats, Space), edit/preview mode toggle, and localStorage persistence.
-   **Theme System**: Comprehensive theme support with 16 predefined themes ensuring consistent styling across all form displays.
-   **Email Activity Timeline**: Real-time webhook integration with Resend for tracking email lifecycle events (sent, delivered, opened, clicked, bounced, failed, complained, delivery_delayed, scheduled) with comprehensive event storage and visual timeline display in contact management.
-   **Multi-Provider Email System**: Implemented comprehensive email provider management system supporting multiple email services with advanced rate limiting (token bucket and sliding window), intelligent retry logic with exponential backoff and jitter, and provider failover for high availability.
-   **UUID-Based Newsletter Group Tracking**: Enhanced newsletter email tracking with unique group identifiers for each newsletter batch using Resend's tags feature for improved webhook processing and real-time engagement updates.
-   **Separate E-Card Settings System**: Dedicated `e_card_settings` table, API endpoints, and client components for complete isolation of e-card configuration from birthday card settings, preventing data conflicts and ensuring system integrity.

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
-   **@measured/puck**: Visual page builder for drag-and-drop newsletter creation.