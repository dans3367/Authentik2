import { Router } from 'express';
import { authenticateToken, requireRole, requirePlanFeature } from '../middleware/auth-middleware';
import { db } from '../db';
import { betterAuthUser, rolePermissions } from '@shared/schema';
import { sql, eq, and } from 'drizzle-orm';

export const roleRoutes = Router();

// ─── Complete permission definitions for each role ───────────────────────────
// Based on actual requireRole() usage across all route files in the application.
// Owner = full access, Administrator = full ops minus billing, Manager = team/content, Employee = basic
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  Owner: {
    // User Management
    'users.view': true,
    'users.create': true,
    'users.edit': true,
    'users.delete': true,
    'users.manage_roles': true,
    'users.toggle_status': true,
    // Shop Management
    'shops.view': true,
    'shops.create': true,
    'shops.edit': true,
    'shops.delete': true,
    'shops.toggle_status': true,
    // Company
    'company.view': true,
    'company.create': true,
    'company.edit': true,
    'company.manage_users': true,
    // Subscriptions & Billing (Owner-only)
    'billing.view': true,
    'billing.manage_subscription': true,
    'billing.manage_checkout': true,
    'billing.view_usage': true,
    // Tenant & Limits
    'tenant.view_limits': true,
    'tenant.edit_limits': true,
    'tenant.fix_issues': true,
    // Email System
    'emails.view': true,
    'emails.send': true,
    'emails.view_status': true,
    'emails.manage_design': true,
    'emails.manage_suppression': true,
    // Newsletters
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'newsletters.view_stats': true,
    // Campaigns
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': true,
    // Contacts
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': true,
    'contacts.import': true,
    'contacts.export': true,
    // Contact Tags
    'tags.view': true,
    'tags.create': true,
    'tags.edit': true,
    'tags.delete': true,
    // Forms
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': true,
    // Promotions
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': true,
    // Custom Cards
    'cards.view': true,
    'cards.create': true,
    'cards.edit': true,
    'cards.manage_images': true,
    // Appointments
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'appointments.manage_reminders': true,
    'appointments.manage_notes': true,
    'appointments.send_reschedule': true,
    // Segments
    'segments.view': true,
    'segments.create': true,
    'segments.edit': true,
    'segments.delete': true,
    // Templates
    'templates.view': true,
    'templates.create': true,
    'templates.edit': true,
    'templates.delete': true,
    'templates.duplicate': true,
    // Birthdays
    'birthdays.view': true,
    'birthdays.manage': true,
    // AI Features
    'ai.use': true,
    // Activity Logs
    'activity.view': true,
    // Analytics & Reports
    'analytics.view_dashboard': true,
    'analytics.view_reports': true,
    'analytics.export': true,
    // Account Usage
    'account_usage.view': true,
    // Admin Panel
    'admin.view_sessions': true,
    'admin.manage_sessions': true,
    'admin.view_system_stats': true,
    'admin.system_health': true,
    // Webhooks
    'webhooks.view': true,
    'webhooks.manage': true,
    // Settings
    'settings.view': true,
    'settings.edit': true,
    'settings.manage_2fa': true,
  },
  Administrator: {
    'users.view': true,
    'users.create': true,
    'users.edit': true,
    'users.delete': true,
    'users.manage_roles': true,
    'users.toggle_status': true,
    'shops.view': true,
    'shops.create': true,
    'shops.edit': true,
    'shops.delete': true,
    'shops.toggle_status': true,
    'company.view': true,
    'company.create': true,
    'company.edit': true,
    'company.manage_users': true,
    'billing.view': true,
    'billing.manage_subscription': false,
    'billing.manage_checkout': false,
    'billing.view_usage': true,
    'tenant.view_limits': true,
    'tenant.edit_limits': true,
    'tenant.fix_issues': true,
    'emails.view': true,
    'emails.send': true,
    'emails.view_status': true,
    'emails.manage_design': true,
    'emails.manage_suppression': true,
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'newsletters.view_stats': true,
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': true,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': true,
    'contacts.import': true,
    'contacts.export': true,
    'tags.view': true,
    'tags.create': true,
    'tags.edit': true,
    'tags.delete': true,
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': true,
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': true,
    'cards.view': true,
    'cards.create': true,
    'cards.edit': true,
    'cards.manage_images': true,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'appointments.manage_reminders': true,
    'appointments.manage_notes': true,
    'appointments.send_reschedule': true,
    'segments.view': true,
    'segments.create': true,
    'segments.edit': true,
    'segments.delete': true,
    'templates.view': true,
    'templates.create': true,
    'templates.edit': true,
    'templates.delete': true,
    'templates.duplicate': true,
    'birthdays.view': true,
    'birthdays.manage': true,
    'ai.use': true,
    'activity.view': true,
    'analytics.view_dashboard': true,
    'analytics.view_reports': true,
    'analytics.export': true,
    'account_usage.view': true,
    'admin.view_sessions': true,
    'admin.manage_sessions': true,
    'admin.view_system_stats': true,
    'admin.system_health': true,
    'webhooks.view': true,
    'webhooks.manage': true,
    'settings.view': true,
    'settings.edit': false,
    'settings.manage_2fa': true,
  },
  Manager: {
    'users.view': true,
    'users.create': false,
    'users.edit': false,
    'users.delete': false,
    'users.manage_roles': false,
    'users.toggle_status': false,
    'shops.view': true,
    'shops.create': true,
    'shops.edit': true,
    'shops.delete': false,
    'shops.toggle_status': true,
    'company.view': true,
    'company.create': false,
    'company.edit': false,
    'company.manage_users': false,
    'billing.view': false,
    'billing.manage_subscription': false,
    'billing.manage_checkout': false,
    'billing.view_usage': false,
    'tenant.view_limits': false,
    'tenant.edit_limits': false,
    'tenant.fix_issues': false,
    'emails.view': true,
    'emails.send': true,
    'emails.view_status': false,
    'emails.manage_design': false,
    'emails.manage_suppression': false,
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'newsletters.view_stats': true,
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': false,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': false,
    'contacts.import': true,
    'contacts.export': true,
    'tags.view': true,
    'tags.create': true,
    'tags.edit': true,
    'tags.delete': false,
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': false,
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': false,
    'cards.view': true,
    'cards.create': true,
    'cards.edit': true,
    'cards.manage_images': true,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'appointments.manage_reminders': true,
    'appointments.manage_notes': true,
    'appointments.send_reschedule': true,
    'segments.view': true,
    'segments.create': true,
    'segments.edit': true,
    'segments.delete': false,
    'templates.view': true,
    'templates.create': true,
    'templates.edit': true,
    'templates.delete': false,
    'templates.duplicate': true,
    'birthdays.view': true,
    'birthdays.manage': true,
    'ai.use': true,
    'activity.view': true,
    'analytics.view_dashboard': true,
    'analytics.view_reports': true,
    'analytics.export': false,
    'account_usage.view': true,
    'admin.view_sessions': false,
    'admin.manage_sessions': false,
    'admin.view_system_stats': false,
    'admin.system_health': false,
    'webhooks.view': false,
    'webhooks.manage': false,
    'settings.view': true,
    'settings.edit': false,
    'settings.manage_2fa': true,
  },
  Employee: {
    'users.view': false,
    'users.create': false,
    'users.edit': false,
    'users.delete': false,
    'users.manage_roles': false,
    'users.toggle_status': false,
    'shops.view': true,
    'shops.create': false,
    'shops.edit': false,
    'shops.delete': false,
    'shops.toggle_status': false,
    'company.view': true,
    'company.create': false,
    'company.edit': false,
    'company.manage_users': false,
    'billing.view': false,
    'billing.manage_subscription': false,
    'billing.manage_checkout': false,
    'billing.view_usage': false,
    'tenant.view_limits': false,
    'tenant.edit_limits': false,
    'tenant.fix_issues': false,
    'emails.view': true,
    'emails.send': false,
    'emails.view_status': false,
    'emails.manage_design': false,
    'emails.manage_suppression': false,
    'newsletters.view': true,
    'newsletters.create': false,
    'newsletters.send': false,
    'newsletters.view_stats': true,
    'campaigns.view': true,
    'campaigns.create': false,
    'campaigns.manage': false,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': false,
    'contacts.delete': false,
    'contacts.import': false,
    'contacts.export': false,
    'tags.view': true,
    'tags.create': false,
    'tags.edit': false,
    'tags.delete': false,
    'forms.view': true,
    'forms.create': false,
    'forms.edit': false,
    'forms.delete': false,
    'promotions.view': true,
    'promotions.create': false,
    'promotions.manage': false,
    'cards.view': true,
    'cards.create': false,
    'cards.edit': false,
    'cards.manage_images': false,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': false,
    'appointments.delete': false,
    'appointments.manage_reminders': false,
    'appointments.manage_notes': true,
    'appointments.send_reschedule': false,
    'segments.view': true,
    'segments.create': false,
    'segments.edit': false,
    'segments.delete': false,
    'templates.view': true,
    'templates.create': false,
    'templates.edit': false,
    'templates.delete': false,
    'templates.duplicate': false,
    'birthdays.view': true,
    'birthdays.manage': false,
    'ai.use': false,
    'activity.view': false,
    'analytics.view_dashboard': false,
    'analytics.view_reports': false,
    'analytics.export': false,
    'account_usage.view': false,
    'admin.view_sessions': false,
    'admin.manage_sessions': false,
    'admin.view_system_stats': false,
    'admin.system_health': false,
    'webhooks.view': false,
    'webhooks.manage': false,
    'settings.view': false,
    'settings.edit': false,
    'settings.manage_2fa': true,
  },
};

// ─── Permission categories for UI grouping ───────────────────────────────────
const PERMISSION_CATEGORIES = [
  {
    key: 'users',
    label: 'User Management',
    description: 'Manage user accounts, roles, and access',
    icon: 'users',
    permissions: [
      { key: 'users.view', label: 'View Users', description: 'View user list and details' },
      { key: 'users.create', label: 'Create Users', description: 'Add new user accounts' },
      { key: 'users.edit', label: 'Edit Users', description: 'Modify user profiles and settings' },
      { key: 'users.delete', label: 'Delete Users', description: 'Remove user accounts' },
      { key: 'users.manage_roles', label: 'Manage Roles', description: 'Change user role assignments' },
      { key: 'users.toggle_status', label: 'Toggle Status', description: 'Activate or deactivate users' },
    ],
  },
  {
    key: 'shops',
    label: 'Shop Management',
    description: 'Manage shop locations and settings',
    icon: 'store',
    permissions: [
      { key: 'shops.view', label: 'View Shops', description: 'View shop list and details' },
      { key: 'shops.create', label: 'Create Shops', description: 'Add new shop locations' },
      { key: 'shops.edit', label: 'Edit Shops', description: 'Modify shop information' },
      { key: 'shops.delete', label: 'Delete Shops', description: 'Remove shop locations' },
      { key: 'shops.toggle_status', label: 'Toggle Status', description: 'Activate or deactivate shops' },
    ],
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Company profile and team management',
    icon: 'building',
    permissions: [
      { key: 'company.view', label: 'View Company', description: 'View company information' },
      { key: 'company.create', label: 'Create Company', description: 'Set up company profile' },
      { key: 'company.edit', label: 'Edit Company', description: 'Modify company details' },
      { key: 'company.manage_users', label: 'Manage Team', description: 'Add/remove company team members' },
    ],
  },
  {
    key: 'billing',
    label: 'Billing & Subscriptions',
    description: 'Subscription plans, payments, and billing',
    icon: 'credit-card',
    permissions: [
      { key: 'billing.view', label: 'View Billing', description: 'View subscription and billing info' },
      { key: 'billing.manage_subscription', label: 'Manage Subscription', description: 'Change, cancel, or reactivate plans' },
      { key: 'billing.manage_checkout', label: 'Manage Checkout', description: 'Create checkout and portal sessions' },
      { key: 'billing.view_usage', label: 'View Usage', description: 'View subscription usage data' },
    ],
  },
  {
    key: 'tenant',
    label: 'Tenant & Limits',
    description: 'Account limits and tenant configuration',
    icon: 'sliders',
    permissions: [
      { key: 'tenant.view_limits', label: 'View Limits', description: 'View account resource limits' },
      { key: 'tenant.edit_limits', label: 'Edit Limits', description: 'Modify account resource limits' },
      { key: 'tenant.fix_issues', label: 'Fix Issues', description: 'Run tenant fix and repair tools' },
    ],
  },
  {
    key: 'emails',
    label: 'Email System',
    description: 'Email sending, design, and management',
    icon: 'mail',
    permissions: [
      { key: 'emails.view', label: 'View Emails', description: 'View email history and logs' },
      { key: 'emails.send', label: 'Send Emails', description: 'Send individual emails' },
      { key: 'emails.view_status', label: 'View Status', description: 'View email system status' },
      { key: 'emails.manage_design', label: 'Manage Design', description: 'Edit master email design template' },
      { key: 'emails.manage_suppression', label: 'Manage Suppression', description: 'Manage email suppression lists' },
    ],
  },
  {
    key: 'newsletters',
    label: 'Newsletters',
    description: 'Newsletter creation and distribution',
    icon: 'newspaper',
    permissions: [
      { key: 'newsletters.view', label: 'View Newsletters', description: 'View newsletter list and content' },
      { key: 'newsletters.create', label: 'Create Newsletters', description: 'Create new newsletters' },
      { key: 'newsletters.send', label: 'Send Newsletters', description: 'Send and schedule newsletters' },
      { key: 'newsletters.view_stats', label: 'View Stats', description: 'View newsletter performance stats' },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    description: 'Marketing campaign management',
    icon: 'megaphone',
    permissions: [
      { key: 'campaigns.view', label: 'View Campaigns', description: 'View campaign list and details' },
      { key: 'campaigns.create', label: 'Create Campaigns', description: 'Create new marketing campaigns' },
      { key: 'campaigns.manage', label: 'Manage Campaigns', description: 'Edit, pause, and delete campaigns' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    description: 'Customer contact management',
    icon: 'contact',
    permissions: [
      { key: 'contacts.view', label: 'View Contacts', description: 'View contact list and profiles' },
      { key: 'contacts.create', label: 'Create Contacts', description: 'Add new contacts' },
      { key: 'contacts.edit', label: 'Edit Contacts', description: 'Modify contact information' },
      { key: 'contacts.delete', label: 'Delete Contacts', description: 'Remove contacts' },
      { key: 'contacts.import', label: 'Import Contacts', description: 'Bulk import contacts' },
      { key: 'contacts.export', label: 'Export Contacts', description: 'Export contact data' },
    ],
  },
  {
    key: 'tags',
    label: 'Contact Tags',
    description: 'Tag management for organizing contacts',
    icon: 'tag',
    permissions: [
      { key: 'tags.view', label: 'View Tags', description: 'View available tags' },
      { key: 'tags.create', label: 'Create Tags', description: 'Create new tags' },
      { key: 'tags.edit', label: 'Edit Tags', description: 'Modify existing tags' },
      { key: 'tags.delete', label: 'Delete Tags', description: 'Remove tags' },
    ],
  },
  {
    key: 'forms',
    label: 'Forms',
    description: 'Form builder and submissions',
    icon: 'file-text',
    permissions: [
      { key: 'forms.view', label: 'View Forms', description: 'View forms and submissions' },
      { key: 'forms.create', label: 'Create Forms', description: 'Build new forms' },
      { key: 'forms.edit', label: 'Edit Forms', description: 'Modify existing forms' },
      { key: 'forms.delete', label: 'Delete Forms', description: 'Remove forms' },
    ],
  },
  {
    key: 'promotions',
    label: 'Promotions',
    description: 'Promotional offers and discounts',
    icon: 'percent',
    permissions: [
      { key: 'promotions.view', label: 'View Promotions', description: 'View promotion list' },
      { key: 'promotions.create', label: 'Create Promotions', description: 'Create new promotions' },
      { key: 'promotions.manage', label: 'Manage Promotions', description: 'Edit and delete promotions' },
    ],
  },
  {
    key: 'cards',
    label: 'Custom Cards',
    description: 'Custom card design and management',
    icon: 'image',
    permissions: [
      { key: 'cards.view', label: 'View Cards', description: 'View custom cards' },
      { key: 'cards.create', label: 'Create Cards', description: 'Design new cards' },
      { key: 'cards.edit', label: 'Edit Cards', description: 'Modify card designs' },
      { key: 'cards.manage_images', label: 'Manage Images', description: 'Upload and manage card images' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    description: 'Appointment scheduling and management',
    icon: 'calendar',
    permissions: [
      { key: 'appointments.view', label: 'View Appointments', description: 'View appointment calendar' },
      { key: 'appointments.create', label: 'Create Appointments', description: 'Schedule new appointments' },
      { key: 'appointments.edit', label: 'Edit Appointments', description: 'Modify appointment details' },
      { key: 'appointments.delete', label: 'Delete Appointments', description: 'Cancel and remove appointments' },
      { key: 'appointments.manage_reminders', label: 'Manage Reminders', description: 'Configure appointment reminders' },
      { key: 'appointments.manage_notes', label: 'Manage Notes', description: 'Add and edit appointment notes' },
      { key: 'appointments.send_reschedule', label: 'Send Reschedule', description: 'Send reschedule emails to customers' },
    ],
  },
  {
    key: 'segments',
    label: 'Segments',
    description: 'Audience segmentation and lists',
    icon: 'layers',
    permissions: [
      { key: 'segments.view', label: 'View Segments', description: 'View segment lists' },
      { key: 'segments.create', label: 'Create Segments', description: 'Create new segments' },
      { key: 'segments.edit', label: 'Edit Segments', description: 'Modify segment criteria' },
      { key: 'segments.delete', label: 'Delete Segments', description: 'Remove segments' },
    ],
  },
  {
    key: 'templates',
    label: 'Templates',
    description: 'Email and content templates',
    icon: 'layout',
    permissions: [
      { key: 'templates.view', label: 'View Templates', description: 'View available templates' },
      { key: 'templates.create', label: 'Create Templates', description: 'Create new templates' },
      { key: 'templates.edit', label: 'Edit Templates', description: 'Modify existing templates' },
      { key: 'templates.delete', label: 'Delete Templates', description: 'Remove templates' },
      { key: 'templates.duplicate', label: 'Duplicate Templates', description: 'Copy existing templates' },
    ],
  },
  {
    key: 'birthdays',
    label: 'Birthdays',
    description: 'Birthday campaign management',
    icon: 'cake',
    permissions: [
      { key: 'birthdays.view', label: 'View Birthdays', description: 'View birthday calendar and campaigns' },
      { key: 'birthdays.manage', label: 'Manage Birthdays', description: 'Configure birthday automations' },
    ],
  },
  {
    key: 'ai',
    label: 'AI Features',
    description: 'AI-powered tools and assistants',
    icon: 'sparkles',
    permissions: [
      { key: 'ai.use', label: 'Use AI', description: 'Access AI content generation and tools' },
    ],
  },
  {
    key: 'activity',
    label: 'Activity Logs',
    description: 'System activity and audit trail',
    icon: 'activity',
    permissions: [
      { key: 'activity.view', label: 'View Activity', description: 'View system activity logs' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics & Reports',
    description: 'Dashboards, reports, and data exports',
    icon: 'bar-chart',
    permissions: [
      { key: 'analytics.view_dashboard', label: 'View Dashboard', description: 'Access analytics dashboard' },
      { key: 'analytics.view_reports', label: 'View Reports', description: 'Access detailed reports' },
      { key: 'analytics.export', label: 'Export Data', description: 'Export analytics data' },
    ],
  },
  {
    key: 'account_usage',
    label: 'Account Usage',
    description: 'Account resource usage overview',
    icon: 'gauge',
    permissions: [
      { key: 'account_usage.view', label: 'View Usage', description: 'View account usage statistics' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin Panel',
    description: 'System administration and health',
    icon: 'shield',
    permissions: [
      { key: 'admin.view_sessions', label: 'View Sessions', description: 'View active user sessions' },
      { key: 'admin.manage_sessions', label: 'Manage Sessions', description: 'Terminate user sessions' },
      { key: 'admin.view_system_stats', label: 'System Stats', description: 'View system-wide statistics' },
      { key: 'admin.system_health', label: 'System Health', description: 'View system health checks' },
    ],
  },
  {
    key: 'webhooks',
    label: 'Webhooks',
    description: 'Webhook integrations and automation',
    icon: 'webhook',
    permissions: [
      { key: 'webhooks.view', label: 'View Webhooks', description: 'View webhook configurations' },
      { key: 'webhooks.manage', label: 'Manage Webhooks', description: 'Create, edit, and delete webhooks' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Application and security settings',
    icon: 'settings',
    permissions: [
      { key: 'settings.view', label: 'View Settings', description: 'View application settings' },
      { key: 'settings.edit', label: 'Edit Settings', description: 'Modify application settings' },
      { key: 'settings.manage_2fa', label: 'Manage 2FA', description: 'Configure two-factor authentication' },
    ],
  },
];

// Helper: merge default permissions with any tenant-specific overrides
function mergePermissions(
  defaults: Record<string, boolean>,
  overrides?: Record<string, boolean>
): Record<string, boolean> {
  if (!overrides) return { ...defaults };
  return { ...defaults, ...overrides };
}

// GET /api/roles - Get all roles with their permissions and user counts
roleRoutes.get("/", authenticateToken, requireRole(['Owner', 'Administrator']), requirePlanFeature('allowRolesManagement'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get user counts per role
    const roleCounts = await db
      .select({
        role: betterAuthUser.role,
        count: sql<number>`count(*)::int`,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId))
      .groupBy(betterAuthUser.role);

    const roleCountMap: Record<string, number> = {};
    roleCounts.forEach((rc: { role: string; count: number }) => {
      roleCountMap[rc.role] = rc.count;
    });

    // Load any custom permission overrides for this tenant
    let customPermissions: Record<string, Record<string, boolean>> = {};
    let hasCustomPermissions = false;
    try {
      const customRows = await db.query.rolePermissions.findMany({
        where: eq(rolePermissions.tenantId, tenantId),
      });
      customRows.forEach((row: any) => {
        try {
          customPermissions[row.role] = JSON.parse(row.permissions);
          hasCustomPermissions = true;
        } catch (e) {
          console.error(`Failed to parse permissions for role ${row.role}:`, e);
        }
      });
    } catch (e) {
      // Table may not exist yet — that's fine, use defaults
      console.log('rolePermissions table not found, using defaults');
    }

    const roleDefinitions = [
      { name: 'Owner', level: 4, description: 'Full system access with billing and subscription management' },
      { name: 'Administrator', level: 3, description: 'Full operational access without billing management' },
      { name: 'Manager', level: 2, description: 'Team and content management with limited admin access' },
      { name: 'Employee', level: 1, description: 'Basic access for day-to-day operations' },
    ];

    const roles = roleDefinitions.map(def => ({
      ...def,
      userCount: roleCountMap[def.name] || 0,
      permissions: mergePermissions(
        DEFAULT_ROLE_PERMISSIONS[def.name],
        customPermissions[def.name]
      ),
      isSystem: true,
      isCustomized: !!customPermissions[def.name],
    }));

    // Count total permissions for stats
    const allPermissionKeys = Object.keys(DEFAULT_ROLE_PERMISSIONS['Owner']);
    const totalPermissions = allPermissionKeys.length;

    res.json({
      roles,
      permissionCategories: PERMISSION_CATEGORIES,
      hasCustomPermissions,
      totalPermissions,
      totalCategories: PERMISSION_CATEGORIES.length,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Failed to get roles' });
  }
});

// PUT /api/roles/permissions - Save custom permissions for a role (Owner only)
roleRoutes.put("/permissions", authenticateToken, requireRole(['Owner']), requirePlanFeature('allowRolesManagement'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { role, permissions } = req.body;

    if (!role || !['Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Owner permissions cannot be customized.' });
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ message: 'Permissions object is required.' });
    }

    // Validate all permission keys exist in defaults
    const validKeys = Object.keys(DEFAULT_ROLE_PERMISSIONS[role]);
    const invalidKeys = Object.keys(permissions).filter(k => !validKeys.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ message: `Invalid permission keys: ${invalidKeys.join(', ')}` });
    }

    const permissionsJson = JSON.stringify(permissions);

    // Upsert: insert or update
    try {
      await db.insert(rolePermissions).values({
        tenantId,
        role,
        permissions: permissionsJson,
        updatedAt: new Date(),
        updatedBy: req.user.id,
      }).onConflictDoUpdate({
        target: [rolePermissions.tenantId, rolePermissions.role],
        set: {
          permissions: permissionsJson,
          updatedAt: new Date(),
          updatedBy: req.user.id,
        },
      });

      res.json({
        message: `Permissions for ${role} updated successfully`,
        role,
      });
    } catch (e: any) {
      if (e.message?.includes('relation "role_permissions" does not exist')) {
        return res.status(503).json({
          message: 'role_permissions table is missing. Please run migrations.',
        });
      }
      throw e;
    }
  } catch (error) {
    console.error('Save permissions error:', error);
    res.status(500).json({ message: 'Failed to save permissions' });
  }
});

// POST /api/roles/permissions/reset - Reset a role's permissions to defaults (Owner only)
roleRoutes.post("/permissions/reset", authenticateToken, requireRole(['Owner']), requirePlanFeature('allowRolesManagement'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { role } = req.body;

    if (!role || !['Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Specify Administrator, Manager, or Employee.' });
    }

    try {
      await db.delete(rolePermissions).where(
        and(
          eq(rolePermissions.tenantId, tenantId),
          eq(rolePermissions.role, role)
        )
      );
    } catch (e) {
      // Table may not exist — that's fine
    }

    res.json({
      message: `Permissions for ${role} reset to defaults`,
      role,
      permissions: DEFAULT_ROLE_PERMISSIONS[role],
    });
  } catch (error) {
    console.error('Reset permissions error:', error);
    res.status(500).json({ message: 'Failed to reset permissions' });
  }
});

// POST /api/roles/permissions/reset-all - Reset ALL role permissions to defaults (Owner only)
roleRoutes.post("/permissions/reset-all", authenticateToken, requireRole(['Owner']), requirePlanFeature('allowRolesManagement'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    try {
      await db.delete(rolePermissions).where(
        eq(rolePermissions.tenantId, tenantId)
      );
    } catch (e) {
      // Table may not exist — that's fine
    }

    res.json({
      message: 'All role permissions reset to defaults',
    });
  } catch (error) {
    console.error('Reset all permissions error:', error);
    res.status(500).json({ message: 'Failed to reset permissions' });
  }
});

// GET /api/roles/users - Get users grouped by role
roleRoutes.get("/users", authenticateToken, requireRole(['Owner', 'Administrator']), requirePlanFeature('allowRolesManagement'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    const users = await db.query.betterAuthUser.findMany({
      where: eq(betterAuthUser.tenantId, tenantId),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: (user: any, { asc }: any) => [asc(user.role), asc(user.firstName)],
    });

    // Group users by role
    const usersByRole: Record<string, typeof users> = {
      Owner: [],
      Administrator: [],
      Manager: [],
      Employee: [],
    };

    users.forEach((user: any) => {
      const role = user.role || 'Employee';
      if (usersByRole[role]) {
        usersByRole[role].push(user);
      }
    });

    res.json({ usersByRole });
  } catch (error) {
    console.error('Get role users error:', error);
    res.status(500).json({ message: 'Failed to get users by role' });
  }
});

// PATCH /api/roles/users/:userId/role - Update a user's role
roleRoutes.patch("/users/:userId/role", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const tenantId = req.user.tenantId;

    if (!role || !['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be Owner, Administrator, Manager, or Employee.' });
    }

    // Check if user exists and belongs to the same tenant
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ),
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cannot change own role
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    // Cannot modify Owner accounts unless you are an Owner
    if (existingUser.role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can modify other owner accounts' });
    }

    // Prevent demoting the only owner
    if (existingUser.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await db.select({
        count: sql<number>`count(*)::int`,
      }).from(betterAuthUser).where(and(
        eq(betterAuthUser.role, 'Owner'),
        eq(betterAuthUser.tenantId, tenantId)
      ));

      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot demote the only owner. Assign another owner first.' });
      }
    }

    // Only Owners can promote to Owner
    if (role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can promote users to the Owner role' });
    }

    // Update user role
    await db.update(betterAuthUser)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ));

    res.json({
      message: `User role updated to ${role} successfully`,
      userId,
      role,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});
