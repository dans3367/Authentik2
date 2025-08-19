# Tech Stack Documentation

## Frontend Technologies

### Core Framework
- **React 18.3.1** - Modern React with hooks and concurrent features
- **TypeScript 5.6.3** - Type-safe JavaScript development
- **Vite 5.4.19** - Fast build tool and development server
- **Wouter 3.3.5** - Lightweight client-side routing

### UI Framework & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Comprehensive component library for accessible UI primitives
  - Dialog, Dropdown Menu, Select, Avatar, Accordion, and 20+ other components
- **Shadcn/ui** - Pre-built components built on Radix UI
- **Lucide React 0.453.0** - Beautiful icon library
- **React Icons 5.4.0** - Popular icon library
- **Framer Motion 11.13.1** - Animation library
- **Class Variance Authority** - Component variant management
- **clsx & tailwind-merge** - Conditional CSS class utilities

### State Management & Data Fetching
- **Redux Toolkit 2.8.2** - Modern Redux state management
- **React Redux 9.2.0** - React bindings for Redux
- **Redux Persist 6.0.0** - State persistence
- **TanStack React Query 5.60.5** - Server state management
- **TanStack React Table 8.21.3** - Powerful table component

### Form Handling & Validation
- **React Hook Form 7.55.0** - Performant forms with easy validation
- **Hookform Resolvers 3.10.0** - Validation library integrations
- **Zod 3.24.2** - TypeScript-first schema validation
- **Drizzle Zod 0.7.0** - Zod integration for Drizzle ORM

### UI Components & Utilities
- **React Day Picker 8.10.1** - Date picker component
- **Input OTP 1.4.2** - One-time password input
- **CMDK 1.1.1** - Command palette component
- **Vaul 1.1.2** - Drawer component
- **React Resizable Panels 2.1.7** - Resizable layout panels
- **Embla Carousel React 8.6.0** - Carousel component
- **Next Themes 0.4.6** - Theme switching

### Drag & Drop
- **DND Kit** - Modern drag and drop toolkit
  - Core 6.3.1
  - Sortable 10.0.0
  - Utilities 3.2.2

## Backend Technologies

### Runtime & Framework
- **Node.js** - JavaScript runtime
- **Express 4.21.2** - Web application framework
- **TypeScript 5.6.3** - Type-safe server development
- **TSX 4.19.1** - TypeScript execution environment

### Database & ORM
- **PostgreSQL** - Primary database (via Neon)
- **Drizzle ORM 0.39.1** - Type-safe SQL ORM
- **Drizzle Kit 0.30.4** - Database migrations and introspection
- **@neondatabase/serverless 0.10.4** - Serverless PostgreSQL driver

### Authentication & Security
- **Passport 0.7.0** - Authentication middleware
- **Passport Local 1.0.0** - Local authentication strategy
- **bcryptjs 3.0.2** - Password hashing
- **jsonwebtoken 9.0.2** - JWT token handling
- **otplib 12.0.1** - One-time password generation
- **qrcode 1.5.4** - QR code generation for 2FA
- **express-rate-limit 8.0.1** - Rate limiting
- **helmet 8.1.0** - Security headers
- **xss 1.0.15** - XSS protection
- **express-mongo-sanitize 2.2.0** - NoSQL injection prevention

### Session Management
- **express-session 1.18.1** - Session middleware
- **connect-pg-simple 10.0.0** - PostgreSQL session store
- **memorystore 1.6.7** - Memory-based session store
- **cookie-parser 1.4.7** - Cookie parsing

### File Upload & Storage
- **Multer 2.0.2** - File upload handling
- **Sharp 0.34.3** - Image processing
- **AWS SDK S3 Client 3.855.0** - S3 file storage
- **S3 Request Presigner 3.855.0** - Pre-signed URL generation

### Payment Processing
- **Stripe 18.3.0** - Server-side payment processing
- **@stripe/stripe-js 7.6.1** - Client-side Stripe integration
- **@stripe/react-stripe-js 3.8.0** - React Stripe components

### Email & Communication
- **Resend 4.7.0** - Email delivery service
- **WebSocket (ws) 8.18.0** - Real-time communication

### Utilities & Helpers
- **date-fns 3.6.0** - Date manipulation library
- **nanoid 5.1.5** - Unique ID generation
- **memoizee 0.4.17** - Function memoization
- **ua-parser-js 2.0.4** - User agent parsing
- **dotenv 17.2.1** - Environment variable loading
- **express-validator 7.2.1** - Request validation

## Development Tools

### Build & Development
- **Vite 5.4.19** - Build tool and dev server
- **esbuild 0.25.0** - Fast JavaScript bundler
- **@vitejs/plugin-react 4.3.2** - React plugin for Vite

### Code Quality & Types
- **TypeScript 5.6.3** - Static type checking
- **@types/** packages - Type definitions for various libraries

### Styling Tools
- **PostCSS 8.4.47** - CSS processing
- **Autoprefixer 10.4.20** - CSS vendor prefixing
- **@tailwindcss/typography 0.5.15** - Typography plugin
- **@tailwindcss/vite 4.1.3** - Vite integration
- **tailwindcss-animate 1.0.7** - Animation utilities

### Development Plugins
- **@replit/vite-plugin-cartographer 0.2.7** - Replit integration
- **@replit/vite-plugin-runtime-error-modal 0.0.3** - Error overlay

## Architecture Patterns

### Multi-tenancy
- Tenant-based data isolation
- Tenant-scoped authentication
- Per-tenant user management

### Authentication Flow
- JWT-based authentication
- Refresh token rotation
- Two-factor authentication (TOTP)
- Device session management
- Email verification

### Database Design
- Multi-tenant architecture with tenant isolation
- Role-based access control (Owner, Administrator, Manager, Employee)
- Subscription management with Stripe integration
- Comprehensive audit trails

### API Design
- RESTful API endpoints
- Express middleware for authentication
- Request validation with express-validator
- Rate limiting and security headers

### Frontend Architecture
- Component-based architecture with React
- Type-safe development with TypeScript
- State management with Redux Toolkit
- Server state with TanStack Query
- Form handling with React Hook Form + Zod
- Responsive design with Tailwind CSS
- Accessible UI with Radix UI components

## Key Features Supported

- **Multi-tenant SaaS application**
- **User management with RBAC**
- **Subscription billing with Stripe**
- **Two-factor authentication**
- **File upload to S3-compatible storage**
- **Email notifications**
- **Real-time features with WebSockets**
- **Form builder functionality**
- **Shop/store management**
- **Responsive dashboard interface**
- **Dark/light theme support**
- **Advanced data tables with filtering and sorting**
- **Drag and drop interfaces**