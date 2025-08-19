# Authentik Project Architecture Overview

## Executive Summary

Authentik is a comprehensive multi-tenant authentication and form management system built with modern web technologies. The project consists of multiple interconnected components that work together to provide a complete solution for user authentication, form creation, and data collection with subscription-based access control.

## Core Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript, Redux Toolkit, React Query
- **Backend**: Node.js with Express.js and TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with session management
- **Payments**: Stripe integration
- **Email**: Resend for transactional emails
- **Process Management**: PM2
- **Build Tools**: Vite (frontend), esbuild (backend)

## Component Breakdown

### 1. Client Application (`/client`)

**Purpose**: The main web application interface for authenticated users.

**Technology**: React 18 with TypeScript, Vite build system

**Key Features**:
- Multi-tenant dashboard
- Form builder with drag-and-drop interface
- User authentication and session management
- Subscription management
- Real-time form analytics
- Responsive design with Tailwind CSS

**Architecture Patterns**:
- **State Management**: Redux Toolkit for auth state (persisted), React Query for server state
- **Routing**: React Router with protected routes
- **Component Library**: Mix of Radix UI and Headless UI components
- **Styling**: Tailwind CSS with custom animations

**Key Directories**:
- `src/components/`: Reusable UI components including AppLayout, form-builder, and ui library
- `src/pages/`: Route-specific page components
- `src/hooks/`: Custom React hooks for business logic
- `src/store/`: Redux store configuration and slices
- `src/lib/`: Utility functions and configurations

### 2. Main Server (`/server`)

**Purpose**: Core API server handling authentication, business logic, and data management.

**Technology**: Node.js with Express.js and TypeScript, built with esbuild

**Key Responsibilities**:
- User authentication and authorization
- Multi-tenant data isolation
- Form CRUD operations
- Form response handling
- Subscription management with Stripe
- Email verification and notifications
- Session management with device tracking

**Key Files**:
- `index.ts`: Main server entry point with middleware setup
- `routes.ts`: API route definitions and handlers
- `storage.ts`: Database interface and implementation
- `db.ts`: Database connection and configuration

**API Structure**:
```
/api/auth/*          - Authentication endpoints
/api/forms/*         - Form management
/api/users/*         - User management
/api/subscriptions/* - Stripe integration
/api/public/*        - Public form embedding endpoints
```

### 3. Form Server (`/fserver`)

**Purpose**: Dedicated service for serving forms to external clients and handling form embedding.

**Technology**: Specialized server optimized for high-throughput form serving

**Key Features**:
- Optimized form delivery
- CORS handling for cross-origin requests
- Caching mechanisms for performance
- Isolated from main application logic

**Integration**: Works in conjunction with the main server to provide scalable form serving capabilities.

### 4. Temporal Go SDK (`/server-go`)

**Purpose**: Asynchronous workflow management using Temporal.

**Technology**: Go with Temporal SDK

**Key Workflows**:
- Email delivery tracking and retry logic
- Form submission processing pipelines
- Scheduled data cleanup tasks
- Analytics data aggregation

**Benefits**:
- Reliable execution of long-running processes
- Automatic retry mechanisms
- Workflow versioning and history
- Distributed processing capabilities

### 5. Database Layer (`/shared`, `/migrations`)

**Purpose**: Centralized data schema and migration management.

**Technology**: PostgreSQL with Drizzle ORM

**Key Components**:
- `shared/schema.ts`: Complete database schema definitions with Zod validation
- `migrations/`: SQL migration files for schema evolution
- Multi-tenant data isolation through `tenantId` fields

**Core Tables**:
```sql
tenants          - Organization/tenant definitions
users            - User accounts with role-based access
forms            - Form definitions with JSON schema
formResponses    - Form submission data
sessions         - User sessions with device tracking
subscriptionPlans - Stripe subscription configurations
```

### 6. Public Assets (`/public`)

**Purpose**: Static assets and client-side embedding tools.

**Key Files**:
- `authentik-forms.js`: JavaScript widget for external form embedding
- `form-embed-example.html`: Comprehensive embedding examples
- `simple-example.html`: Basic embedding demonstration

**Widget Features**:
- Self-contained with inline CSS
- Multiple theme support (Minimal, Modern)
- Shadow DOM option for style isolation
- CORS-compliant and CSP-friendly

## Data Flow Architecture

### 1. User Authentication Flow
```
Client → Main Server → Database → Redis/Memory (Sessions) → Client
```

**Process**:
1. User submits credentials
2. Server validates against database
3. JWT token generated and session stored
4. Client receives token and user data
5. Redux store updated with auth state

### 2. Form Creation Flow
```
Client (Form Builder) → Main Server → Database → Client (Updated State)
```

**Process**:
1. User designs form in drag-and-drop builder
2. Form schema validated and sent to server
3. Server stores form with tenant isolation
4. React Query cache updated
5. UI reflects new form state

### 3. Public Form Embedding Flow
```
External Site → Form Server/Main Server → Database → External Site
```

**Process**:
1. External site loads `authentik-forms.js` widget
2. Widget requests form data from public API
3. Server validates form access and returns data
4. Widget renders form with applied theming
5. Form submissions sent back to public API

### 4. Subscription Management Flow
```
Client → Main Server → Stripe API → Webhook → Main Server → Database
```

**Process**:
1. User initiates subscription change
2. Server creates Stripe checkout/billing session
3. User completes payment with Stripe
4. Stripe sends webhook to server
5. Server updates user subscription status
6. Client receives updated subscription state

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with configurable expiration
- **Session Management**: Server-side session storage with device tracking
- **Role-Based Access**: Owner, Administrator, Manager, Employee roles
- **Multi-Factor Authentication**: TOTP-based 2FA with QR code generation

### Data Protection
- **Multi-Tenancy**: Strict data isolation through `tenantId` filtering
- **Password Security**: bcrypt hashing with salt rounds
- **Input Validation**: Zod schemas for all API endpoints
- **SQL Injection Prevention**: Parameterized queries through Drizzle ORM

### External Access
- **CORS Configuration**: Controlled cross-origin access for public APIs
- **CSP Management**: Content Security Policy with relaxed rules for public endpoints
- **Rate Limiting**: Request throttling for public APIs
- **Input Sanitization**: XSS prevention for form submissions

## Deployment Architecture

### Process Management
- **PM2**: Production process management with clustering
- **Environment Configuration**: `.env` file with environment-specific settings
- **Build Pipeline**: Separate builds for client (Vite) and server (esbuild)

### Database Management
- **Migration System**: Version-controlled schema changes
- **Connection Pooling**: Optimized database connections
- **Backup Strategy**: Regular automated backups

### Scalability Considerations
- **Stateless Design**: JWT-based authentication allows horizontal scaling
- **Database Indexing**: Optimized queries with proper indexing
- **Caching Layer**: Form data caching for improved performance
- **CDN Ready**: Static assets can be served from CDN

## Development Workflow

### Build System
```bash
npm run dev     # Development server with hot reload
npm run build   # Production build (client + server)
npm run start   # Production server
```

### Database Operations
```bash
npm run db:push # Apply schema changes
npm run db:init # Initialize database
```

### Code Quality
- **TypeScript**: Strict type checking across the entire stack
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Linting**: ESLint configuration for consistent code style

## Integration Points

### External Services
- **Stripe**: Payment processing and subscription management
- **Resend**: Transactional email delivery
- **Temporal**: Workflow orchestration and async processing

### API Interfaces
- **REST API**: Primary client-server communication
- **WebSocket**: Real-time updates (future enhancement)
- **Public API**: External form embedding interface

## Future Extensibility

### Planned Enhancements
- **Real-time Collaboration**: Multi-user form editing
- **Advanced Analytics**: Form performance metrics
- **Webhook System**: Form submission notifications
- **API Gateway**: Centralized API management

### Scalability Path
- **Microservices**: Component separation for independent scaling
- **Event-Driven Architecture**: Async communication between services
- **Containerization**: Docker deployment for cloud platforms
- **Monitoring**: Application performance monitoring and logging

## Conclusion

The Authentik architecture provides a robust, scalable foundation for a multi-tenant authentication and form management system. The separation of concerns between frontend, backend, form serving, and workflow management allows for independent development and scaling of each component while maintaining strong integration points for seamless user experience.

The use of modern technologies like React, TypeScript, and Temporal, combined with proven patterns like JWT authentication and multi-tenancy, ensures both developer productivity and system reliability. The public form embedding capability extends the platform's reach beyond authenticated users, making it a comprehensive solution for form-based data collection needs.
