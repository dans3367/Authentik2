# Automatic Tenant Creation on User Signup

## Overview

The authentication system now automatically creates a dedicated tenant (organization) for each new user during the signup process. This ensures proper multi-tenant isolation and eliminates foreign key constraint violations.

## How It Works

### 1. User Signs Up
When a user registers via Better Auth (`/api/auth/sign-up/email`):
- User provides email, password, and name
- Better Auth creates the user record
- User is temporarily assigned to the **Default Organization** tenant

### 2. Automatic Tenant Creation
Immediately after user creation, a Better Auth hook executes:
- Creates a new tenant with:
  - **Name**: `{User Name}'s Organization` (e.g., "John Doe's Organization")
  - **Slug**: Based on email username (e.g., `john-doe` from `john.doe@example.com`)
  - **Max Users**: 10 (default)
  - **Status**: Active
- Updates the user record with the new tenant ID
- Sets user role to **Owner**

### 3. Result
The user becomes the owner of their own organization and can:
- Create promotions, templates, and other tenant-scoped resources
- Invite additional users to their organization
- Manage their organization settings

## Technical Implementation

### Configuration Files Modified

#### 1. `server/auth.ts`
Added Better Auth hook that runs after user creation:

```typescript
hooks: {
  after: [
    {
      matcher: () => true,
      handler: async (context: any) => {
        if (context.type === "user.created") {
          // Create tenant
          // Update user with new tenant_id
        }
      },
    },
  ],
}
```

#### 2. `shared/schema.ts`
Updated default values:
- `role`: Default changed to `'Owner'`
- `tenantId`: Temporary default set to Default Organization ID
  - `'2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff'`

#### 3. `migrations/024_update_tenant_default.sql`
Migration to update database defaults:
```sql
ALTER TABLE better_auth_user 
ALTER COLUMN tenant_id SET DEFAULT '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff';

ALTER TABLE better_auth_user 
ALTER COLUMN role SET DEFAULT 'Owner';
```

### Slug Conflict Resolution

The system handles duplicate slugs gracefully:
- Base slug: Email username converted to lowercase, special chars replaced with hyphens
- If slug exists: Appends `-1`, `-2`, etc.
- Maximum 10 attempts to find unique slug

Example:
- `john@example.com` → `john`
- If `john` exists → `john-1`
- If `john-1` exists → `john-2`

## Default Tenant

**Default Organization** (`2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff`):
- Used as temporary tenant during signup
- Users are only in this tenant for milliseconds during the signup process
- The hook immediately creates their own tenant

## Error Handling

If tenant creation fails:
- User signup still succeeds
- User remains in Default Organization
- Error is logged for manual intervention
- Admin can manually create tenant and migrate user later

This prevents users from being stuck in a broken state.

## Testing

To verify the configuration:

```bash
npx tsx test-signup-hook.ts
```

This checks:
- ✅ Default tenant exists
- ✅ Database default value is correct
- ✅ All tenants are listed

## Benefits

1. **Automatic Multi-Tenancy**: Each user gets their own isolated organization
2. **No Manual Setup**: No need for admin intervention
3. **Proper Isolation**: Resources are scoped to the correct tenant from day one
4. **Scalable**: Supports unlimited organizations
5. **Owner By Default**: Users have full control over their organization

## Migration Notes

### Existing Users
Existing users are not affected by this change. Their tenant associations remain unchanged.

### New Users
All new signups after this implementation will automatically get their own tenant.

## Troubleshooting

### Issue: User has null tenant_id
**Cause**: Hook failed to execute
**Solution**: Manually create tenant and update user:
```sql
-- Create tenant
INSERT INTO tenants (name, slug, is_active, max_users)
VALUES ('User Organization', 'user-slug', true, 10)
RETURNING id;

-- Update user
UPDATE better_auth_user 
SET tenant_id = '<new-tenant-id>', role = 'Owner'
WHERE id = '<user-id>';
```

### Issue: Slug conflicts
**Cause**: Multiple users with similar email prefixes
**Resolution**: Automatic (system appends `-1`, `-2`, etc.)

### Issue: User in Default Organization
**Cause**: Hook execution failed
**Check Logs**: Look for "Failed to create tenant for new user"
**Action**: Run manual migration script to create tenant and update user

## Future Enhancements

Potential improvements:
- [ ] Allow custom organization name during signup
- [ ] Add organization settings page
- [ ] Support organization logos/branding
- [ ] Multi-user organization invites
- [ ] Organization transfer ownership

