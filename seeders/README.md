# Database Seeders

This directory contains database seeder scripts for setting up demo data and test users.

## Owner Company Seeder

The `create-owner-company-seeder.ts` script creates a complete setup for Owner users with their own separate company and tenant.

### What it creates:

1. **Separate Company/Tenant**: "Example Corporation"
   - Company Name: Example Corporation
   - Slug: `example-corp`
   - Industry: Technology
   - Max Users: 100
   - Website: https://example.com

2. **Two Owner Users**:
   - `owner@example.com` (password: `password123`)
   - `owner2@example.com` (password: `password123`)

### Features:

✅ **BetterAuth Integration**: Uses proper BetterAuth APIs for user creation with correct password hashing
✅ **Separate Tenant**: Users belong to their own company tenant, isolated from other organizations
✅ **Owner Privileges**: Both users have full Owner role permissions
✅ **Email Verification**: Users are automatically verified and active
✅ **Idempotent**: Can be run multiple times safely - will update existing users instead of creating duplicates

### Usage:

```bash
# Run the seeder
npm run seed:owner-company

# Or run directly with tsx
DATABASE_URL="your_database_url" npx tsx seeders/create-owner-company-seeder.ts
```

### Configuration:

The seeder configuration can be modified in the script:

```typescript
const COMPANY_CONFIG: CompanyConfig = {
  name: "Example Corporation",
  slug: "example-corp", 
  description: "Example Corporation - Demo company for Owner users",
  website: "https://example.com",
  industry: "Technology",
  maxUsers: 100
};

const OWNER_USERS: OwnerUserConfig[] = [
  {
    email: "owner@example.com",
    name: "Owner User",
    firstName: "Owner",
    lastName: "User", 
    password: "password123"
  },
  // ... more users
];
```

### Output:

The seeder provides detailed logging and will show:
- Company/tenant creation status
- User creation/update status  
- Final verification of all created entities
- Login credentials for testing

### Database Structure:

After running, you'll have:
- New entry in `tenants` table with company information
- New entry in `companies` table with company details
- Two users in `better_auth_user` table with Owner role
- Corresponding entries in `better_auth_account` table with proper password hashes

### Testing Login:

After running the seeder, you can test login with:
- Email: `owner@example.com` or `owner2@example.com`
- Password: `password123`

Both users will have full Owner privileges and belong to the "Example Corporation" tenant.
