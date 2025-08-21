import { 
  users, 
  refreshTokens, 
  subscriptionPlans, 
  subscriptions,
  tenants,
  forms,
  formResponses,
  verificationTokens,
  companies,
  shops,
  emailContacts,
  emailLists,
  contactTags,
  contactListMemberships,
  contactTagAssignments,
  newsletters,
  newsletterTaskStatus,
  campaigns,
  emailActivity,
  type User, 
  type InsertUser, 
  type RefreshToken, 
  type UserFilters, 
  type CreateUserData, 
  type UpdateUserData, 
  type SubscriptionPlan, 
  type InsertSubscriptionPlan, 
  type Subscription, 
  type InsertSubscription,
  type Tenant,
  type InsertTenant,
  type CreateTenantData,
  type UpdateTenantData,
  type RegisterOwnerData,
  type Form,
  type InsertForm,
  type CreateFormData,
  type UpdateFormData,
  type FormResponse,
  type InsertFormResponse,
  type SubmitFormResponseData,
  type UserWithTenant,
  type FormWithDetails,
  type Company,
  type InsertCompany,
  type CreateCompanyData,
  type UpdateCompanyData,
  type Shop,
  type InsertShop,
  type CreateShopData,
  type UpdateShopData,
  type ShopFilters,
  type ShopWithManager,
  type EmailContact,
  type InsertEmailContact,
  type CreateEmailContactData,
  type UpdateEmailContactData,
  type EmailList,
  type InsertEmailList,
  type CreateEmailListData,
  type ContactTag,
  type InsertContactTag,
  type CreateContactTagData,
  type EmailContactWithDetails,
  type EmailListWithCount,
  type ContactFilters,
  type Newsletter,
  type InsertNewsletter,
  type CreateNewsletterData,
  type UpdateNewsletterData,
  type NewsletterWithUser,
  type NewsletterTaskStatus,
  type InsertNewsletterTaskStatus,
  type CreateNewsletterTaskStatusData,
  type UpdateNewsletterTaskStatusData,
  type Campaign,
  type InsertCampaign,
  type CreateCampaignData,
  type UpdateCampaignData,
  type EmailActivity,
  type InsertEmailActivity,
  type CreateEmailActivityData
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, lt, gte, lte, desc, ne, or, ilike, count, sql, inArray } from "drizzle-orm";

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
}

export interface IStorage {
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: CreateTenantData): Promise<Tenant>;
  updateTenant(id: string, updates: UpdateTenantData): Promise<Tenant | undefined>;
  
  // Special Owner registration operation that creates both tenant and Owner user
  createOwnerAndTenant(ownerData: RegisterOwnerData): Promise<{ owner: User; tenant: Tenant }>;
  
  // Method to find the Owner of a tenant (for login logic)
  getTenantOwner(tenantId: string): Promise<User | undefined>;
  
  // Method to find a user by email across all tenants (for login)
  findUserByEmailAcrossTenants(email: string): Promise<(User & { tenant: { id: string; name: string; slug: string } }) | undefined>;
  
  // User operations (now tenant-aware)
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>, tenantId: string): Promise<User | undefined>;
  
  // User management operations (tenant-aware)
  getAllUsers(tenantId: string, filters?: UserFilters): Promise<User[]>;
  getUserStats(tenantId: string): Promise<{ totalUsers: number; activeUsers: number; usersByRole: Record<string, number> }>;
  createUserAsAdmin(userData: CreateUserData, tenantId: string): Promise<User>;
  updateUserAsAdmin(id: string, userData: UpdateUserData, tenantId: string): Promise<User | undefined>;
  deleteUser(id: string, tenantId: string): Promise<void>;
  toggleUserStatus(id: string, isActive: boolean, tenantId: string): Promise<User | undefined>;
  getManagerUsers(tenantId: string): Promise<User[]>;
  
  // Refresh token operations with device tracking (tenant-aware)
  createRefreshToken(userId: string, tenantId: string, token: string, expiresAt: Date, deviceInfo?: DeviceInfo): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  updateRefreshToken(id: string, token: string, tenantId: string): Promise<void>;
  deleteRefreshToken(token: string): Promise<void>;
  deleteUserRefreshTokens(userId: string, tenantId: string): Promise<void>;
  cleanExpiredTokens(): Promise<void>;
  
  // Device session management (tenant-aware)
  getUserSessions(userId: string, tenantId: string): Promise<RefreshToken[]>;
  updateSessionLastUsed(token: string): Promise<void>;
  deleteSession(sessionId: string, userId: string, tenantId: string): Promise<void>;
  deleteAllUserSessions(userId: string, tenantId: string): Promise<void>;
  deleteOtherUserSessions(userId: string, currentRefreshToken: string, tenantId: string): Promise<void>;
  refreshTokenExists(refreshTokenId: string, tenantId: string): Promise<boolean>;
  
  // Email verification (tenant-aware)
  setEmailVerificationToken(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<void>;
  getUserByEmailVerificationToken(token: string, tenantId?: string): Promise<User | undefined>;
  verifyUserEmail(userId: string, tenantId: string): Promise<void>;
  updateLastVerificationEmailSent(userId: string, tenantId: string): Promise<void>;
  
  // Forms operations (tenant-aware)
  createForm(formData: CreateFormData, userId: string, tenantId: string): Promise<Form>;
  getForm(id: string, tenantId: string): Promise<Form | undefined>;
  getPublicForm(id: string): Promise<Form | undefined>;
  getUserForms(userId: string, tenantId: string): Promise<Form[]>;
  getTenantForms(tenantId: string): Promise<FormWithDetails[]>;
  updateForm(id: string, updates: UpdateFormData, tenantId: string): Promise<Form | undefined>;
  deleteForm(id: string, tenantId: string): Promise<void>;
  
  // Form responses operations (tenant-aware)
  submitFormResponse(responseData: SubmitFormResponseData, tenantId: string): Promise<FormResponse>;
  getFormResponses(formId: string, tenantId: string): Promise<FormResponse[]>;
  getFormResponseCount(formId: string, tenantId: string): Promise<number>;
  
  // Subscription plans
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  
  // User subscriptions
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(id: string, tenantId?: string): Promise<Subscription | undefined>;
  getUserSubscription(userId: string, tenantId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, updates: Partial<Subscription>, tenantId?: string): Promise<Subscription | undefined>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string, tenantId: string): Promise<void>;
  
  // SaaS Limits and Validation
  getTenantSubscription(tenantId: string): Promise<(Subscription & { plan: SubscriptionPlan }) | undefined>;
  checkUserLimits(tenantId: string): Promise<{ canAddUser: boolean; currentUsers: number; maxUsers: number | null; planName: string }>;
  validateUserCreation(tenantId: string): Promise<void>;
  checkShopLimits(tenantId: string): Promise<{ canAddShop: boolean; currentShops: number; maxShops: number | null; planName: string }>;
  validateShopCreation(tenantId: string): Promise<void>;
  
  // Shop operations (tenant-aware)
  getShop(id: string, tenantId: string): Promise<Shop | undefined>;
  getShopWithManager(id: string, tenantId: string): Promise<ShopWithManager | undefined>;
  getAllShops(tenantId: string, filters?: ShopFilters): Promise<ShopWithManager[]>;
  getShopsByManager(managerId: string, tenantId: string): Promise<Shop[]>;
  createShop(shop: CreateShopData, tenantId: string): Promise<Shop>;
  updateShop(id: string, updates: UpdateShopData, tenantId: string): Promise<Shop | undefined>;
  deleteShop(id: string, tenantId: string): Promise<void>;
  toggleShopStatus(id: string, isActive: boolean, tenantId: string): Promise<Shop | undefined>;
  
  // Email contact operations (tenant-aware)
  getEmailContact(id: string, tenantId: string): Promise<EmailContact | undefined>;
  getEmailContactWithDetails(id: string, tenantId: string): Promise<EmailContactWithDetails | undefined>;
  getAllEmailContacts(tenantId: string, filters?: ContactFilters): Promise<EmailContactWithDetails[]>;
  createEmailContact(contact: CreateEmailContactData, tenantId: string): Promise<EmailContact>;
  updateEmailContact(id: string, updates: UpdateEmailContactData, tenantId: string): Promise<EmailContact | undefined>;
  deleteEmailContact(id: string, tenantId: string): Promise<void>;
  bulkDeleteEmailContacts(ids: string[], tenantId: string): Promise<void>;
  
  // Email list operations (tenant-aware)
  getEmailList(id: string, tenantId: string): Promise<EmailList | undefined>;
  getAllEmailLists(tenantId: string): Promise<EmailListWithCount[]>;
  createEmailList(list: CreateEmailListData, tenantId: string): Promise<EmailList>;
  updateEmailList(id: string, name: string, description: string | undefined, tenantId: string): Promise<EmailList | undefined>;
  deleteEmailList(id: string, tenantId: string): Promise<void>;
  
  // Contact tag operations (tenant-aware)
  getContactTag(id: string, tenantId: string): Promise<ContactTag | undefined>;
  getAllContactTags(tenantId: string): Promise<ContactTag[]>;
  createContactTag(tag: CreateContactTagData, tenantId: string): Promise<ContactTag>;
  updateContactTag(id: string, name: string, color: string, tenantId: string): Promise<ContactTag | undefined>;
  deleteContactTag(id: string, tenantId: string): Promise<void>;
  
  // Contact list membership operations (tenant-aware)
  addContactToList(contactId: string, listId: string, tenantId: string): Promise<void>;
  removeContactFromList(contactId: string, listId: string, tenantId: string): Promise<void>;
  getContactLists(contactId: string, tenantId: string): Promise<EmailList[]>;
  bulkAddContactsToList(contactIds: string[], listId: string, tenantId: string): Promise<void>;
  
  // Contact tag assignment operations (tenant-aware)
  addTagToContact(contactId: string, tagId: string, tenantId: string): Promise<void>;
  removeTagFromContact(contactId: string, tagId: string, tenantId: string): Promise<void>;
  getContactTags(contactId: string, tenantId: string): Promise<ContactTag[]>;
  bulkAddTagToContacts(contactIds: string[], tagId: string, tenantId: string): Promise<void>;
  
  // Email contact statistics (tenant-aware)
  getEmailContactStats(tenantId: string): Promise<{
    totalContacts: number;
    activeContacts: number;
    unsubscribedContacts: number;
    bouncedContacts: number;
    pendingContacts: number;
    totalLists: number;
    averageEngagementRate: number;
  }>;
  getShopStats(tenantId: string): Promise<{ totalShops: number; activeShops: number; shopsByCategory: Record<string, number> }>;
  
  // Newsletter operations (tenant-aware)
  getNewsletter(id: string, tenantId: string): Promise<Newsletter | undefined>;
  // Cross-tenant lookup by ID (used for webhook fallbacks)
  getNewsletterById(id: string): Promise<Newsletter | undefined>;
  // Debug method to list all contacts (for debugging webhook issues)
  getAllEmailContactsDebug(): Promise<{ email: string; tenantId: string; id: string }[]>;
  getNewsletterWithUser(id: string, tenantId: string): Promise<NewsletterWithUser | undefined>;
  getAllNewsletters(tenantId: string): Promise<NewsletterWithUser[]>;
  createNewsletter(newsletter: CreateNewsletterData, userId: string, tenantId: string): Promise<Newsletter>;
  updateNewsletter(id: string, updates: UpdateNewsletterData, tenantId: string): Promise<Newsletter | undefined>;
  deleteNewsletter(id: string, tenantId: string): Promise<void>;
  getNewsletterStats(tenantId: string): Promise<{
    totalNewsletters: number;
    draftNewsletters: number;
    scheduledNewsletters: number;
    sentNewsletters: number;
  }>;

  // Newsletter task status operations (tenant-aware)
  getNewsletterTaskStatuses(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]>;
  createNewsletterTaskStatus(newsletterId: string, taskData: CreateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus>;
  updateNewsletterTaskStatus(id: string, updates: UpdateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus | undefined>;
  deleteNewsletterTaskStatus(id: string, tenantId: string): Promise<void>;
  initializeNewsletterTasks(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]>;

  // Campaign operations (tenant-aware)
  getCampaign(id: string, tenantId: string): Promise<Campaign | undefined>;
  getAllCampaigns(tenantId: string): Promise<Campaign[]>;
  createCampaign(campaign: CreateCampaignData, userId: string, tenantId: string): Promise<Campaign>;
  updateCampaign(id: string, updates: UpdateCampaignData, tenantId: string): Promise<Campaign | undefined>;
  deleteCampaign(id: string, tenantId: string): Promise<void>;
  getCampaignStats(tenantId: string): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    draftCampaigns: number;
    completedCampaigns: number;
  }>;

  // Email activity operations for webhook tracking
  createEmailActivity(activityData: CreateEmailActivityData, tenantId: string): Promise<EmailActivity>;
  getEmailActivity(id: string, tenantId: string): Promise<EmailActivity | undefined>;
  getContactActivity(contactId: string, tenantId: string, limit?: number): Promise<EmailActivity[]>;
  getActivityByWebhookId(webhookId: string, tenantId: string): Promise<EmailActivity | undefined>;
  findEmailContactByEmail(email: string): Promise<{ contact: EmailContact; tenantId: string } | undefined>;
  // Check for existing email opens to prevent duplicates by email ID
  getExistingEmailOpenByEmailId(emailId: string, tenantId: string): Promise<EmailActivity | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: UpdateTenantData): Promise<Tenant | undefined> {
    const [tenant] = await db.update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  // Special Owner registration operation that creates both tenant and Owner user
  async createOwnerAndTenant(ownerData: RegisterOwnerData): Promise<{ owner: User; tenant: Tenant }> {
    // Start a transaction to ensure both tenant and owner are created or none
    const result = await db.transaction(async (tx) => {
      // Create the tenant first
      const [tenant] = await tx.insert(tenants).values({
        name: ownerData.organizationName,
        slug: ownerData.organizationSlug,
        isActive: true,
        maxUsers: 10, // Default max users for new organizations
      }).returning();

      // Create the owner user
      const [owner] = await tx.insert(users).values({
        tenantId: tenant.id,
        email: ownerData.email,
        password: ownerData.password, // This should be hashed before calling this method
        firstName: ownerData.firstName,
        lastName: ownerData.lastName,
        role: 'Owner',
        isActive: true,
        emailVerified: false, // Owner still needs to verify email
        updatedAt: new Date(),
      }).returning();

      return { owner, tenant };
    });

    return result;
  }

  // Method to find the Owner of a tenant (for login logic)
  async getTenantOwner(tenantId: string): Promise<User | undefined> {
    const [owner] = await db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'Owner')))
      .limit(1);
    return owner;
  }

  // Method to find a user by email across all tenants (for login)
  async findUserByEmailAcrossTenants(email: string): Promise<(User & { tenant: { id: string; name: string; slug: string } }) | undefined> {
    // Important: We use .select() without parameters to select all fields
    // This ensures Drizzle properly maps database column names (like avatar_url) to schema field names (like avatarUrl)
    // Using explicit field selection can break this mapping for some fields
    const result = await db
      .select({
        // User fields
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
        lastVerificationEmailSent: users.lastVerificationEmailSent,
        lastLoginAt: users.lastLoginAt,
        menuExpanded: users.menuExpanded,
        theme: users.theme,
        avatarUrl: users.avatarUrl,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionPlanId: users.subscriptionPlanId,
        subscriptionStartDate: users.subscriptionStartDate,
        subscriptionEndDate: users.subscriptionEndDate,
        trialEndsAt: users.trialEndsAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        // Tenant fields
        tenant: {
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
        },
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(and(eq(users.email, email), eq(users.isActive, true), eq(tenants.isActive, true)))
      .limit(1);

    if (!result[0]) return undefined;

    // When using .select() with joins, Drizzle returns nested objects for each table
    const userWithTenant = result[0];
    const userData = userWithTenant;
    const tenantData = userWithTenant.tenant;

    return {
      ...userData,
      tenant: {
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
      },
    } as (User & { tenant: { id: string; name: string; slug: string } });
  }

  // User operations (tenant-aware)
  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
    
    return user;
  }

  async getUserByEmail(email: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();
    return user;
  }

  async createRefreshToken(userId: string, tenantId: string, token: string, expiresAt: Date, deviceInfo?: DeviceInfo): Promise<RefreshToken> {
    const [refreshToken] = await db
      .insert(refreshTokens)
      .values({
        userId,
        tenantId,
        token,
        expiresAt,
        deviceId: deviceInfo?.deviceId,
        deviceName: deviceInfo?.deviceName,
        userAgent: deviceInfo?.userAgent,
        ipAddress: deviceInfo?.ipAddress,
        location: deviceInfo?.location,
        lastUsed: new Date(),
        isActive: true,
      })
      .returning();
    return refreshToken;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, token),
        gt(refreshTokens.expiresAt, new Date())
      ));
    return refreshToken;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }

  async deleteUserRefreshTokens(userId: string, tenantId: string): Promise<void> {
    await db.delete(refreshTokens).where(and(
      eq(refreshTokens.userId, userId),
      eq(refreshTokens.tenantId, tenantId)
    ));
  }

  async cleanExpiredTokens(): Promise<void> {
    await db.delete(refreshTokens).where(
      lt(refreshTokens.expiresAt, new Date())
    );
  }

  // Device session management methods
  async getUserSessions(userId: string, tenantId: string): Promise<RefreshToken[]> {
    const sessions = await db
      .select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tenantId, tenantId),
        eq(refreshTokens.isActive, true),
        gt(refreshTokens.expiresAt, new Date())
      ))
      .orderBy(desc(refreshTokens.lastUsed));
    return sessions;
  }

  async updateSessionLastUsed(token: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ lastUsed: new Date() })
      .where(eq(refreshTokens.token, token));
  }

  async deleteSession(sessionId: string, userId: string, tenantId: string): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(and(
        eq(refreshTokens.id, sessionId),
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tenantId, tenantId)
      ));
  }

  async deleteAllUserSessions(userId: string, tenantId: string): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tenantId, tenantId)
      ));
  }

  async deleteOtherUserSessions(userId: string, currentRefreshToken: string, tenantId: string): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tenantId, tenantId),
        ne(refreshTokens.token, currentRefreshToken)
      ));
  }

  async updateRefreshToken(id: string, token: string, tenantId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ token })
      .where(and(eq(refreshTokens.id, id), eq(refreshTokens.tenantId, tenantId)));
  }

  async refreshTokenExists(refreshTokenId: string, tenantId: string): Promise<boolean> {
    const [token] = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.id, refreshTokenId),
        eq(refreshTokens.tenantId, tenantId),
        eq(refreshTokens.isActive, true),
        gt(refreshTokens.expiresAt, new Date())
      ))
      .limit(1);
    return !!token;
  }

  // Email verification methods (tenant-aware)
  async setEmailVerificationToken(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        emailVerificationToken: token,
        emailVerificationExpires: expiresAt,
        lastVerificationEmailSent: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  }

  async getUserByEmailVerificationToken(token: string, tenantId?: string): Promise<User | undefined> {
    const conditions = [
      eq(users.emailVerificationToken, token),
      gt(users.emailVerificationExpires, new Date())
    ];
    
    // Add tenant filtering if tenantId is provided
    if (tenantId) {
      conditions.push(eq(users.tenantId, tenantId));
    }
    
    const [user] = await db
      .select()
      .from(users)
      .where(and(...conditions));
    return user;
  }

  async verifyUserEmail(userId: string, tenantId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date()
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  }

  async updateLastVerificationEmailSent(userId: string, tenantId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        lastVerificationEmailSent: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  }

  // Subscription plans methods
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values({
        ...plan,
        updatedAt: new Date(),
      })
      .returning();
    return newPlan;
  }

  // User subscriptions methods
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        ...subscription,
        updatedAt: new Date(),
      })
      .returning();
    return newSubscription;
  }

  async getSubscription(id: string, tenantId?: string): Promise<Subscription | undefined> {
    const conditions = [eq(subscriptions.id, id)];
    
    // Add tenant filtering if tenantId is provided for security
    if (tenantId) {
      conditions.push(eq(subscriptions.tenantId, tenantId));
    }
    
    const [subscription] = await db.select().from(subscriptions).where(and(...conditions));
    return subscription;
  }

  async getUserSubscription(userId: string, tenantId: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.tenantId, tenantId)))
      .orderBy(desc(subscriptions.createdAt));
    return subscription;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>, tenantId?: string): Promise<Subscription | undefined> {
    const conditions = [eq(subscriptions.id, id)];
    
    // Add tenant filtering if tenantId is provided for security
    if (tenantId) {
      conditions.push(eq(subscriptions.tenantId, tenantId));
    }
    
    const [subscription] = await db
      .update(subscriptions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    return subscription;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string, tenantId: string): Promise<void> {
    await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
  }

  // Forms operations (tenant-aware)
  async createForm(formData: CreateFormData, userId: string, tenantId: string): Promise<Form> {
    const [form] = await db
      .insert(forms)
      .values({
        ...formData,
        userId,
        tenantId,
        updatedAt: new Date(),
      })
      .returning();
    return form;
  }

  async getForm(id: string, tenantId: string): Promise<Form | undefined> {
    const [form] = await db.select().from(forms)
      .where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)));
    return form;
  }

  async getPublicForm(id: string): Promise<Form | undefined> {
    const [form] = await db.select().from(forms).where(eq(forms.id, id));
    return form;
  }

  async getUserForms(userId: string, tenantId: string): Promise<Form[]> {
    return await db.select().from(forms)
      .where(and(eq(forms.userId, userId), eq(forms.tenantId, tenantId)))
      .orderBy(desc(forms.createdAt));
  }

  async getTenantForms(tenantId: string): Promise<FormWithDetails[]> {
    return await db.select({
      id: forms.id,
      tenantId: forms.tenantId,
      userId: forms.userId,
      title: forms.title,
      description: forms.description,
      formData: forms.formData,
      theme: forms.theme,
      isActive: forms.isActive,
      responseCount: forms.responseCount,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
      tenant: {
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
      }
    })
    .from(forms)
    .innerJoin(users, eq(forms.userId, users.id))
    .innerJoin(tenants, eq(forms.tenantId, tenants.id))
    .where(eq(forms.tenantId, tenantId))
    .orderBy(desc(forms.createdAt)) as FormWithDetails[];
  }

  async updateForm(id: string, updates: UpdateFormData, tenantId: string): Promise<Form | undefined> {
    const [form] = await db
      .update(forms)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)))
      .returning();
    return form;
  }

  async deleteForm(id: string, tenantId: string): Promise<void> {
    await db.delete(forms).where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)));
  }

  // Form responses operations (tenant-aware)
  async submitFormResponse(responseData: SubmitFormResponseData, tenantId: string): Promise<FormResponse> {
    const [response] = await db
      .insert(formResponses)
      .values({
        ...responseData,
        tenantId,
      })
      .returning();
    
    // Update response count
    await db
      .update(forms)
      .set({ 
        responseCount: sql`${forms.responseCount} + 1`,
        updatedAt: new Date()
      })
      .where(and(eq(forms.id, responseData.formId), eq(forms.tenantId, tenantId)));
    
    return response;
  }

  async getFormResponses(formId: string, tenantId: string): Promise<FormResponse[]> {
    return await db.select().from(formResponses)
      .where(and(eq(formResponses.formId, formId), eq(formResponses.tenantId, tenantId)))
      .orderBy(desc(formResponses.submittedAt));
  }

  async getFormResponseCount(formId: string, tenantId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(formResponses)
      .where(and(eq(formResponses.formId, formId), eq(formResponses.tenantId, tenantId)));
    return result.count;
  }

  // User management methods (tenant-aware)
  async getAllUsers(tenantId: string, filters?: UserFilters): Promise<User[]> {
    const conditions = [eq(users.tenantId, tenantId)];

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm),
          ilike(users.email, searchTerm)
        )!
      );
    }

    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters?.status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (filters?.status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    } else if (!filters?.showInactive) {
      conditions.push(eq(users.isActive, true));
    }

    const whereClause = and(...conditions);
    
    const result = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt));
    
    return result;
  }

  async getUserStats(tenantId: string): Promise<{ totalUsers: number; activeUsers: number; usersByRole: Record<string, number> }> {
    // Get total and active user counts for tenant
    const [totalResult] = await db.select({ count: count() }).from(users).where(eq(users.tenantId, tenantId));
    const [activeResult] = await db.select({ count: count() }).from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

    // Get user counts by role for tenant
    const roleResults = await db
      .select({ 
        role: users.role, 
        count: count() 
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
      .groupBy(users.role);

    const usersByRole: Record<string, number> = {};
    roleResults.forEach(result => {
      usersByRole[result.role] = result.count;
    });

    return {
      totalUsers: totalResult.count,
      activeUsers: activeResult.count,
      usersByRole
    };
  }

  async createUserAsAdmin(userData: CreateUserData, tenantId: string): Promise<User> {
    const { confirmPassword, ...userInsertData } = userData;
    const [user] = await db
      .insert(users)
      .values({
        ...userInsertData,
        tenantId,
        emailVerified: true, // Admin-created users are automatically verified
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUserAsAdmin(id: string, userData: UpdateUserData, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();
    return user;
  }

  async deleteUser(id: string, tenantId: string): Promise<void> {
    // First delete all refresh tokens
    await db.delete(refreshTokens).where(and(eq(refreshTokens.userId, id), eq(refreshTokens.tenantId, tenantId)));
    // Then delete the user
    await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
  }

  async toggleUserStatus(id: string, isActive: boolean, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();
    return user;
  }

  async getManagerUsers(tenantId: string): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          // Include Managers, Administrators, and Owners as eligible reviewers
          or(
            eq(users.role, 'Manager'),
            eq(users.role, 'Administrator'),
            eq(users.role, 'Owner')
          ),
          eq(users.isActive, true)
        )
      )
      .orderBy(users.firstName);
    
    return result;
  }

  // Company management methods (tenant-aware)
  async getUserCompany(userId: string, tenantId: string): Promise<(Company & { owner: { id: string; firstName: string | null; lastName: string | null; email: string } }) | null> {
    const result = await db
      .select({
        id: companies.id,
        tenantId: companies.tenantId,
        ownerId: companies.ownerId,
        name: companies.name,
        address: companies.address,
        companyType: companies.companyType,
        companyEmail: companies.companyEmail,
        phone: companies.phone,
        website: companies.website,
        description: companies.description,
        isActive: companies.isActive,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        owner: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(companies)
      .innerJoin(users, eq(companies.ownerId, users.id))
      .where(and(eq(companies.ownerId, userId), eq(companies.tenantId, tenantId)))
      .limit(1);
    
    return result[0] || null;
  }

  async createCompany(companyData: CreateCompanyData, ownerId: string, tenantId: string): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values({
        ...companyData,
        ownerId,
        tenantId,
        updatedAt: new Date(),
      })
      .returning();
    return company;
  }

  async updateUserCompany(userId: string, companyData: UpdateCompanyData, tenantId: string): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...companyData, updatedAt: new Date() })
      .where(and(eq(companies.ownerId, userId), eq(companies.tenantId, tenantId)))
      .returning();
    return company;
  }

  // SaaS Limits and Validation
  async getTenantSubscription(tenantId: string): Promise<(Subscription & { plan: SubscriptionPlan }) | undefined> {
    const result = await db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        stripeCustomerId: subscriptions.stripeCustomerId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        trialStart: subscriptions.trialStart,
        trialEnd: subscriptions.trialEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        isYearly: subscriptions.isYearly,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        plan: {
          id: subscriptionPlans.id,
          name: subscriptionPlans.name,
          displayName: subscriptionPlans.displayName,
          description: subscriptionPlans.description,
          price: subscriptionPlans.price,
          yearlyPrice: subscriptionPlans.yearlyPrice,
          stripePriceId: subscriptionPlans.stripePriceId,
          stripeYearlyPriceId: subscriptionPlans.stripeYearlyPriceId,
          features: subscriptionPlans.features,
          maxUsers: subscriptionPlans.maxUsers,
          maxProjects: subscriptionPlans.maxProjects,
          maxShops: subscriptionPlans.maxShops,
          storageLimit: subscriptionPlans.storageLimit,
          supportLevel: subscriptionPlans.supportLevel,
          trialDays: subscriptionPlans.trialDays,
          isPopular: subscriptionPlans.isPopular,
          isActive: subscriptionPlans.isActive,
          sortOrder: subscriptionPlans.sortOrder,
          createdAt: subscriptionPlans.createdAt,
          updatedAt: subscriptionPlans.updatedAt,
        },
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'trialing'))
      ))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      ...row,
      plan: row.plan,
    } as Subscription & { plan: SubscriptionPlan };
  }

  async checkUserLimits(tenantId: string): Promise<{ canAddUser: boolean; currentUsers: number; maxUsers: number | null; planName: string }> {
    // Get current total user count for the tenant (count all users including inactive)
    const userCountResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.tenantId, tenantId));
    
    const currentUsers = userCountResult[0]?.count || 0;

    // Get tenant's subscription and plan limits
    const subscription = await this.getTenantSubscription(tenantId);
    
    if (!subscription) {
      // No subscription found - use basic plan limits as default
      const basicPlan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, 'basic'))
        .limit(1);
      
      const maxUsers = basicPlan[0]?.maxUsers || 20; // Default to 20 if basic plan not found
      return {
        canAddUser: currentUsers < maxUsers,
        currentUsers,
        maxUsers,
        planName: basicPlan[0]?.displayName || 'Basic Plan',
      };
    }

    const maxUsers = subscription.plan.maxUsers;
    const planName = subscription.plan.displayName;

    return {
      canAddUser: maxUsers === null || currentUsers < maxUsers, // null means unlimited
      currentUsers,
      maxUsers,
      planName,
    };
  }

  async validateUserCreation(tenantId: string): Promise<void> {
    const limits = await this.checkUserLimits(tenantId);
    
    if (!limits.canAddUser) {
      if (limits.maxUsers === null) {
        // This shouldn't happen, but just in case
        throw new Error('Unable to validate user limits');
      }
      
      throw new Error(
        `User limit reached. Your ${limits.planName} allows ${limits.maxUsers} users, and you currently have ${limits.currentUsers}. Please upgrade your plan to add more users.`
      );
    }
  }

  async checkShopLimits(tenantId: string): Promise<{ canAddShop: boolean; currentShops: number; maxShops: number | null; planName: string }> {
    // Get current shop count
    const shopsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(shops)
      .where(eq(shops.tenantId, tenantId));
    
    const currentShops = shopsResult[0]?.count || 0;
    
    // Get tenant subscription
    const subscription = await this.getTenantSubscription(tenantId);
    
    if (!subscription) {
      // No subscription found - use basic plan limits as default
      const basicPlan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, 'basic'))
        .limit(1);
      
      const maxShops = basicPlan[0]?.maxShops || 10; // Default to 10 if basic plan not found
      return {
        canAddShop: currentShops < maxShops,
        currentShops,
        maxShops,
        planName: basicPlan[0]?.displayName || 'Basic Plan',
      };
    }

    const maxShops = subscription.plan.maxShops;
    const planName = subscription.plan.displayName;

    return {
      canAddShop: maxShops === null || currentShops < maxShops, // null means unlimited
      currentShops,
      maxShops,
      planName,
    };
  }

  async validateShopCreation(tenantId: string): Promise<void> {
    const limits = await this.checkShopLimits(tenantId);
    
    if (!limits.canAddShop) {
      if (limits.maxShops === null) {
        // This shouldn't happen, but just in case
        throw new Error('Unable to validate shop limits');
      }
      
      throw new Error(
        `Shop limit reached. Your ${limits.planName} allows ${limits.maxShops} shops, and you currently have ${limits.currentShops}. Please upgrade your plan to add more shops.`
      );
    }
  }

  // Shop operations (tenant-aware)
  async getShop(id: string, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops)
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)));
    return shop;
  }

  async getShopWithManager(id: string, tenantId: string): Promise<ShopWithManager | undefined> {
    const result = await db
      .select({
        id: shops.id,
        tenantId: shops.tenantId,
        name: shops.name,
        description: shops.description,
        address: shops.address,
        city: shops.city,
        state: shops.state,
        zipCode: shops.zipCode,
        country: shops.country,
        phone: shops.phone,
        email: shops.email,
        website: shops.website,
        managerId: shops.managerId,
        operatingHours: shops.operatingHours,
        status: shops.status,
        logoUrl: shops.logoUrl,
        bannerUrl: shops.bannerUrl,
        category: shops.category,
        tags: shops.tags,
        socialMedia: shops.socialMedia,
        settings: shops.settings,
        isActive: shops.isActive,
        createdAt: shops.createdAt,
        updatedAt: shops.updatedAt,
        manager: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        },
      })
      .from(shops)
      .leftJoin(users, eq(shops.managerId, users.id))
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      ...row,
      manager: row.manager?.id ? row.manager as User : undefined,
    } as ShopWithManager;
  }

  async getAllShops(tenantId: string, filters?: ShopFilters): Promise<ShopWithManager[]> {
    const conditions = [eq(shops.tenantId, tenantId)];
    
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(shops.status, filters.status));
    }
    
    if (filters?.category) {
      conditions.push(eq(shops.category, filters.category));
    }
    
    if (filters?.managerId) {
      conditions.push(eq(shops.managerId, filters.managerId));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(shops.name, `%${filters.search}%`),
          ilike(shops.city, `%${filters.search}%`),
          ilike(shops.email, `%${filters.search}%`),
          ilike(shops.phone, `%${filters.search}%`)
        ) || sql`true`
      );
    }
    
    const result = await db
      .select({
        id: shops.id,
        tenantId: shops.tenantId,
        name: shops.name,
        description: shops.description,
        address: shops.address,
        city: shops.city,
        state: shops.state,
        zipCode: shops.zipCode,
        country: shops.country,
        phone: shops.phone,
        email: shops.email,
        website: shops.website,
        managerId: shops.managerId,
        operatingHours: shops.operatingHours,
        status: shops.status,
        logoUrl: shops.logoUrl,
        bannerUrl: shops.bannerUrl,
        category: shops.category,
        tags: shops.tags,
        socialMedia: shops.socialMedia,
        settings: shops.settings,
        isActive: shops.isActive,
        createdAt: shops.createdAt,
        updatedAt: shops.updatedAt,
        manager: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        },
      })
      .from(shops)
      .leftJoin(users, eq(shops.managerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(shops.createdAt));
    
    return result.map(row => ({
      ...row,
      manager: row.manager?.id ? row.manager as User : undefined,
    })) as ShopWithManager[];
  }

  async getShopsByManager(managerId: string, tenantId: string): Promise<Shop[]> {
    return db.select().from(shops)
      .where(and(eq(shops.managerId, managerId), eq(shops.tenantId, tenantId)));
  }

  async createShop(shopData: CreateShopData, tenantId: string): Promise<Shop> {
    // Validate shop limits before creating
    await this.validateShopCreation(tenantId);
    
    const [shop] = await db
      .insert(shops)
      .values({
        ...shopData,
        tenantId,
        updatedAt: new Date(),
      })
      .returning();
    return shop;
  }

  async updateShop(id: string, updates: UpdateShopData, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db
      .update(shops)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)))
      .returning();
    return shop;
  }

  async deleteShop(id: string, tenantId: string): Promise<void> {
    await db.delete(shops).where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)));
  }

  async toggleShopStatus(id: string, isActive: boolean, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db
      .update(shops)
      .set({ 
        isActive, 
        status: isActive ? 'active' : 'inactive',
        updatedAt: new Date() 
      })
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)))
      .returning();
    return shop;
  }

  async getShopStats(tenantId: string): Promise<{ totalShops: number; activeShops: number; shopsByCategory: Record<string, number> }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(shops)
      .where(eq(shops.tenantId, tenantId));
    
    const [activeResult] = await db
      .select({ count: count() })
      .from(shops)
      .where(and(eq(shops.tenantId, tenantId), eq(shops.isActive, true)));
    
    const categoryResult = await db
      .select({
        category: shops.category,
        count: count(),
      })
      .from(shops)
      .where(eq(shops.tenantId, tenantId))
      .groupBy(shops.category);
    
    const shopsByCategory: Record<string, number> = {};
    categoryResult.forEach(row => {
      if (row.category) {
        shopsByCategory[row.category] = row.count;
      }
    });
    
    return {
      totalShops: totalResult.count,
      activeShops: activeResult.count,
      shopsByCategory,
    };
  }

  // Email contact operations
  async getEmailContact(id: string, tenantId: string): Promise<EmailContact | undefined> {
    const [contact] = await db
      .select()
      .from(emailContacts)
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)));
    return contact;
  }

  async getEmailContactWithDetails(id: string, tenantId: string): Promise<EmailContactWithDetails | undefined> {
    const contact = await this.getEmailContact(id, tenantId);
    if (!contact) return undefined;

    const tags = await this.getContactTags(id, tenantId);
    const lists = await this.getContactLists(id, tenantId);

    return {
      ...contact,
      tags,
      lists,
    };
  }

  async getAllEmailContacts(tenantId: string, filters?: ContactFilters): Promise<EmailContactWithDetails[]> {
    const conditions = [eq(emailContacts.tenantId, tenantId)];
    
    if (filters) {
      if (filters.search) {
        conditions.push(
          or(
            ilike(emailContacts.email, `%${filters.search}%`),
            ilike(emailContacts.firstName, `%${filters.search}%`),
            ilike(emailContacts.lastName, `%${filters.search}%`),
            ilike(sql`${emailContacts.firstName} || ' ' || ${emailContacts.lastName}`, `%${filters.search}%`)
          )!
        );
      }
      
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(emailContacts.status, filters.status));
      }
    }

    const contacts = await db
      .select()
      .from(emailContacts)
      .where(and(...conditions))
      .orderBy(desc(emailContacts.createdAt));

    // Add tags and lists for each contact
    const contactsWithDetails = await Promise.all(
      contacts.map(async (contact) => {
        const tags = await this.getContactTags(contact.id, tenantId);
        const lists = await this.getContactLists(contact.id, tenantId);
        return {
          ...contact,
          tags,
          lists,
        };
      })
    );

    return contactsWithDetails;
  }

  async createEmailContact(contactData: CreateEmailContactData, tenantId: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<EmailContact> {
    const [contact] = await db
      .insert(emailContacts)
      .values({
        ...contactData,
        tenantId,
        consentDate: contactData.consentGiven ? new Date() : null,
        consentIpAddress: ipAddress,
        consentUserAgent: userAgent,
        addedByUserId: userId,
      })
      .returning();

    // Add to lists if specified
    if (contactData.lists && contactData.lists.length > 0) {
      await Promise.all(
        contactData.lists.map(listId => 
          this.addContactToList(contact.id, listId, tenantId)
        )
      );
    }

    // Add tags if specified
    if (contactData.tags && contactData.tags.length > 0) {
      await Promise.all(
        contactData.tags.map(tagId => 
          this.addTagToContact(contact.id, tagId, tenantId)
        )
      );
    }

    return contact;
  }

  async updateEmailContact(id: string, updates: UpdateEmailContactData, tenantId: string): Promise<EmailContact | undefined> {
    // Handle date field properly
    const processedUpdates = { ...updates };
    if ('consentDate' in processedUpdates && processedUpdates.consentDate) {
      // Ensure consentDate is properly formatted as a Date object
      if (typeof processedUpdates.consentDate === 'string') {
        processedUpdates.consentDate = new Date(processedUpdates.consentDate);
      }
    }

    const [contact] = await db
      .update(emailContacts)
      .set({
        ...processedUpdates,
        updatedAt: new Date(),
      })
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)))
      .returning();
    return contact;
  }

  async deleteEmailContact(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailContacts)
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)));
  }

  async bulkDeleteEmailContacts(ids: string[], tenantId: string): Promise<void> {
    await db
      .delete(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        inArray(emailContacts.id, ids)
      ));
  }

  // Email list operations
  async getEmailList(id: string, tenantId: string): Promise<EmailList | undefined> {
    const [list] = await db
      .select()
      .from(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
    return list;
  }

  async getAllEmailLists(tenantId: string): Promise<EmailListWithCount[]> {
    const lists = await db
      .select()
      .from(emailLists)
      .where(eq(emailLists.tenantId, tenantId))
      .orderBy(emailLists.name);

    const listsWithCount = await Promise.all(
      lists.map(async (list) => {
        const [countResult] = await db
          .select({ count: count() })
          .from(contactListMemberships)
          .where(and(
            eq(contactListMemberships.listId, list.id),
            eq(contactListMemberships.tenantId, tenantId)
          ));

        return {
          ...list,
          count: countResult.count,
        };
      })
    );

    return listsWithCount;
  }

  async createEmailList(listData: CreateEmailListData, tenantId: string): Promise<EmailList> {
    const [list] = await db
      .insert(emailLists)
      .values({
        ...listData,
        tenantId,
      })
      .returning();
    return list;
  }

  async updateEmailList(id: string, name: string, description: string | undefined, tenantId: string): Promise<EmailList | undefined> {
    const [list] = await db
      .update(emailLists)
      .set({
        name,
        description,
        updatedAt: new Date(),
      })
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)))
      .returning();
    return list;
  }

  async deleteEmailList(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
  }

  // Contact tag operations
  async getContactTag(id: string, tenantId: string): Promise<ContactTag | undefined> {
    const [tag] = await db
      .select()
      .from(contactTags)
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)));
    return tag;
  }

  async getAllContactTags(tenantId: string): Promise<ContactTag[]> {
    return await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.tenantId, tenantId))
      .orderBy(contactTags.name);
  }

  async createContactTag(tagData: CreateContactTagData, tenantId: string): Promise<ContactTag> {
    const [tag] = await db
      .insert(contactTags)
      .values({
        ...tagData,
        tenantId,
      })
      .returning();
    return tag;
  }

  async updateContactTag(id: string, name: string, color: string, tenantId: string): Promise<ContactTag | undefined> {
    const [tag] = await db
      .update(contactTags)
      .set({
        name,
        color,
      })
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)))
      .returning();
    return tag;
  }

  async deleteContactTag(id: string, tenantId: string): Promise<void> {
    await db
      .delete(contactTags)
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)));
  }

  // Contact list membership operations
  async addContactToList(contactId: string, listId: string, tenantId: string): Promise<void> {
    await db
      .insert(contactListMemberships)
      .values({
        contactId,
        listId,
        tenantId,
      })
      .onConflictDoNothing();
  }

  async removeContactFromList(contactId: string, listId: string, tenantId: string): Promise<void> {
    await db
      .delete(contactListMemberships)
      .where(and(
        eq(contactListMemberships.contactId, contactId),
        eq(contactListMemberships.listId, listId),
        eq(contactListMemberships.tenantId, tenantId)
      ));
  }

  async getContactLists(contactId: string, tenantId: string): Promise<EmailList[]> {
    const result = await db
      .select({
        id: emailLists.id,
        tenantId: emailLists.tenantId,
        name: emailLists.name,
        description: emailLists.description,
        createdAt: emailLists.createdAt,
        updatedAt: emailLists.updatedAt,
      })
      .from(contactListMemberships)
      .innerJoin(emailLists, eq(contactListMemberships.listId, emailLists.id))
      .where(and(
        eq(contactListMemberships.contactId, contactId),
        eq(contactListMemberships.tenantId, tenantId)
      ));
    
    return result;
  }

  async bulkAddContactsToList(contactIds: string[], listId: string, tenantId: string): Promise<void> {
    const values = contactIds.map(contactId => ({
      contactId,
      listId,
      tenantId,
    }));

    await db
      .insert(contactListMemberships)
      .values(values)
      .onConflictDoNothing();
  }

  // Contact tag assignment operations
  async addTagToContact(contactId: string, tagId: string, tenantId: string): Promise<void> {
    await db
      .insert(contactTagAssignments)
      .values({
        contactId,
        tagId,
        tenantId,
      })
      .onConflictDoNothing();
  }

  async removeTagFromContact(contactId: string, tagId: string, tenantId: string): Promise<void> {
    await db
      .delete(contactTagAssignments)
      .where(and(
        eq(contactTagAssignments.contactId, contactId),
        eq(contactTagAssignments.tagId, tagId),
        eq(contactTagAssignments.tenantId, tenantId)
      ));
  }

  async getContactTags(contactId: string, tenantId: string): Promise<ContactTag[]> {
    const result = await db
      .select({
        id: contactTags.id,
        tenantId: contactTags.tenantId,
        name: contactTags.name,
        color: contactTags.color,
        createdAt: contactTags.createdAt,
      })
      .from(contactTagAssignments)
      .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
      .where(and(
        eq(contactTagAssignments.contactId, contactId),
        eq(contactTagAssignments.tenantId, tenantId)
      ));
    
    return result;
  }

  async bulkAddTagToContacts(contactIds: string[], tagId: string, tenantId: string): Promise<void> {
    const values = contactIds.map(contactId => ({
      contactId,
      tagId,
      tenantId,
    }));

    await db
      .insert(contactTagAssignments)
      .values(values)
      .onConflictDoNothing();
  }

  // Email contact statistics
  async getEmailContactStats(tenantId: string): Promise<{
    totalContacts: number;
    activeContacts: number;
    unsubscribedContacts: number;
    bouncedContacts: number;
    pendingContacts: number;
    totalLists: number;
    averageEngagementRate: number;
  }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(eq(emailContacts.tenantId, tenantId));

    const [activeResult] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailContacts.status, 'active')
      ));

    const [unsubscribedResult] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailContacts.status, 'unsubscribed')
      ));

    const [bouncedResult] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailContacts.status, 'bounced')
      ));

    const [pendingResult] = await db
      .select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailContacts.status, 'pending')
      ));

    const [listsResult] = await db
      .select({ count: count() })
      .from(emailLists)
      .where(eq(emailLists.tenantId, tenantId));

    // Calculate average engagement rate from actual email activities
    const [sentActivitiesResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'sent')
      ));

    const [openedActivitiesResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'opened')
      ));

    const totalSent = sentActivitiesResult.count;
    const totalOpened = openedActivitiesResult.count;
    const averageEngagementRate = totalSent > 0 
      ? Math.round((totalOpened / totalSent) * 100) 
      : 0;

    return {
      totalContacts: totalResult.count,
      activeContacts: activeResult.count,
      unsubscribedContacts: unsubscribedResult.count,
      bouncedContacts: bouncedResult.count,
      pendingContacts: pendingResult.count,
      totalLists: listsResult.count,
      averageEngagementRate,
    };
  }

  async getContactEngagementStats(contactId: string, tenantId: string): Promise<{
    emailsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    emailsBounced: number;
    emailsDelivered: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }> {
    // Get sent emails count
    const [sentResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailActivity.contactId, contactId),
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'sent')
      ));

    // Get opened emails count
    const [openedResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailActivity.contactId, contactId),
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'opened')
      ));

    // Get clicked emails count
    const [clickedResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailActivity.contactId, contactId),
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'clicked')
      ));

    // Get bounced emails count
    const [bouncedResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailActivity.contactId, contactId),
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'bounced')
      ));

    // Get delivered emails count
    const [deliveredResult] = await db
      .select({ count: count() })
      .from(emailActivity)
      .innerJoin(emailContacts, eq(emailActivity.contactId, emailContacts.id))
      .where(and(
        eq(emailActivity.contactId, contactId),
        eq(emailContacts.tenantId, tenantId),
        eq(emailActivity.activityType, 'delivered')
      ));

    const emailsSent = sentResult.count;
    const emailsOpened = openedResult.count;
    const emailsClicked = clickedResult.count;
    const emailsBounced = bouncedResult.count;
    const emailsDelivered = deliveredResult.count;

    // Calculate rates
    const openRate = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0;
    const clickRate = emailsSent > 0 ? Math.round((emailsClicked / emailsSent) * 100) : 0;
    const bounceRate = emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 100) : 0;

    return {
      emailsSent,
      emailsOpened,
      emailsClicked,
      emailsBounced,
      emailsDelivered,
      openRate,
      clickRate,
      bounceRate,
    };
  }

  // Newsletter operations
  async getNewsletter(id: string, tenantId: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)));
    return newsletter;
  }

  async getNewsletterById(id: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, id))
      .limit(1);
    return newsletter;
  }

  async getAllEmailContactsDebug(): Promise<{ email: string; tenantId: string; id: string }[]> {
    const contacts = await db
      .select({
        id: emailContacts.id,
        email: emailContacts.email,
        tenantId: emailContacts.tenantId,
      })
      .from(emailContacts)
      .limit(50); // Limit for debugging
    
    return contacts;
  }

  async getNewsletterWithUser(id: string, tenantId: string): Promise<NewsletterWithUser | undefined> {
    const [result] = await db
      .select({
        newsletter: newsletters,
        user: users,
      })
      .from(newsletters)
      .innerJoin(users, eq(newsletters.userId, users.id))
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.newsletter,
      user: result.user,
    };
  }

  async getAllNewsletters(tenantId: string): Promise<NewsletterWithUser[]> {
    const results = await db
      .select({
        newsletter: newsletters,
        user: users,
      })
      .from(newsletters)
      .innerJoin(users, eq(newsletters.userId, users.id))
      .where(eq(newsletters.tenantId, tenantId))
      .orderBy(desc(newsletters.createdAt));

    return results.map((result) => ({
      ...result.newsletter,
      user: result.user,
    }));
  }

  async createNewsletter(newsletterData: CreateNewsletterData, userId: string, tenantId: string): Promise<Newsletter> {
    const [newsletter] = await db
      .insert(newsletters)
      .values({
        ...newsletterData,
        userId,
        tenantId,
      })
      .returning();
    return newsletter;
  }

  async updateNewsletter(id: string, updates: UpdateNewsletterData, tenantId: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db
      .update(newsletters)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)))
      .returning();
    return newsletter;
  }

  async deleteNewsletter(id: string, tenantId: string): Promise<void> {
    await db
      .delete(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)));
  }



  async getNewsletterStats(tenantId: string): Promise<{
    totalNewsletters: number;
    draftNewsletters: number;
    scheduledNewsletters: number;
    sentNewsletters: number;
  }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(newsletters)
      .where(eq(newsletters.tenantId, tenantId));

    const [draftResult] = await db
      .select({ count: count() })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'draft')
      ));

    const [scheduledResult] = await db
      .select({ count: count() })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'scheduled')
      ));

    const [sentResult] = await db
      .select({ count: count() })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'sent')
      ));

    return {
      totalNewsletters: totalResult.count,
      draftNewsletters: draftResult.count,
      scheduledNewsletters: scheduledResult.count,
      sentNewsletters: sentResult.count,
    };
  }

  // Newsletter task status operations
  async getNewsletterTaskStatuses(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]> {
    return await db
      .select()
      .from(newsletterTaskStatus)
      .where(and(
        eq(newsletterTaskStatus.newsletterId, newsletterId),
        eq(newsletterTaskStatus.tenantId, tenantId)
      ))
      .orderBy(newsletterTaskStatus.createdAt);
  }

  async createNewsletterTaskStatus(newsletterId: string, taskData: CreateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus> {
    const [taskStatus] = await db
      .insert(newsletterTaskStatus)
      .values({
        ...taskData,
        newsletterId,
        tenantId,
      })
      .returning();
    return taskStatus;
  }

  async updateNewsletterTaskStatus(id: string, updates: UpdateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus | undefined> {
    const [taskStatus] = await db
      .update(newsletterTaskStatus)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(newsletterTaskStatus.id, id), eq(newsletterTaskStatus.tenantId, tenantId)))
      .returning();
    return taskStatus;
  }

  async deleteNewsletterTaskStatus(id: string, tenantId: string): Promise<void> {
    await db
      .delete(newsletterTaskStatus)
      .where(and(eq(newsletterTaskStatus.id, id), eq(newsletterTaskStatus.tenantId, tenantId)));
  }

  async initializeNewsletterTasks(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]> {
    const defaultTasks = [
      {
        taskType: 'validation' as const,
        taskName: 'Content Validation',
        status: 'completed' as const,
        progress: 100,
        details: 'Content structure and HTML validated successfully',
      },
      {
        taskType: 'processing' as const,
        taskName: 'Template Processing',
        status: 'pending' as const,
        progress: 0,
        details: 'Waiting to process email template and recipient list',
      },
      {
        taskType: 'sending' as const,
        taskName: 'Email Delivery',
        status: 'pending' as const,
        progress: 0,
        details: 'Waiting for scheduled send time',
      },
      {
        taskType: 'analytics' as const,
        taskName: 'Analytics Collection',
        status: 'pending' as const,
        progress: 0,
        details: 'Will start after email delivery',
      },
    ];

    const tasks: NewsletterTaskStatus[] = [];
    for (const task of defaultTasks) {
      const [createdTask] = await db
        .insert(newsletterTaskStatus)
        .values({
          ...task,
          newsletterId,
          tenantId,
        })
        .returning();
      tasks.push(createdTask);
    }
    
    return tasks;
  }

  // Campaign operations
  async getCampaign(id: string, tenantId: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
    return campaign;
  }

  async getAllCampaigns(tenantId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId))
      .orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaignData: CreateCampaignData, userId: string, tenantId: string): Promise<Campaign> {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        ...campaignData,
        budget: campaignData.budget ? campaignData.budget.toString() : null,
        userId,
        tenantId,
      })
      .returning();
    return campaign;
  }

  async updateCampaign(id: string, updates: UpdateCampaignData, tenantId: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({
        ...updates,
        budget: updates.budget !== undefined ? (updates.budget ? updates.budget.toString() : null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
      .returning();
    return campaign;
  }

  async deleteCampaign(id: string, tenantId: string): Promise<void> {
    await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
  }

  async getCampaignStats(tenantId: string): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    draftCampaigns: number;
    completedCampaigns: number;
  }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId));

    const [activeResult] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(and(
        eq(campaigns.tenantId, tenantId),
        eq(campaigns.status, 'active')
      ));

    const [draftResult] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(and(
        eq(campaigns.tenantId, tenantId),
        eq(campaigns.status, 'draft')
      ));

    const [completedResult] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(and(
        eq(campaigns.tenantId, tenantId),
        eq(campaigns.status, 'completed')
      ));

    return {
      totalCampaigns: totalResult.count,
      activeCampaigns: activeResult.count,
      draftCampaigns: draftResult.count,
      completedCampaigns: completedResult.count,
    };
  }

  // Email activity operations for webhook tracking
  async createEmailActivity(activityData: CreateEmailActivityData, tenantId: string): Promise<EmailActivity> {
    const [activity] = await db
      .insert(emailActivity)
      .values({
        ...activityData,
        tenantId,
      })
      .returning();
    return activity;
  }

  async getEmailActivity(id: string, tenantId: string): Promise<EmailActivity | undefined> {
    const [activity] = await db
      .select()
      .from(emailActivity)
      .where(and(eq(emailActivity.id, id), eq(emailActivity.tenantId, tenantId)));
    return activity;
  }

  async getContactActivity(contactId: string, tenantId: string, limit?: number, fromDate?: Date, toDate?: Date): Promise<EmailActivity[]> {
    const whereConditions = [
      eq(emailActivity.contactId, contactId),
      eq(emailActivity.tenantId, tenantId)
    ];
    
    if (fromDate) {
      whereConditions.push(gte(emailActivity.occurredAt, fromDate));
    }
    
    if (toDate) {
      whereConditions.push(lte(emailActivity.occurredAt, toDate));
    }
    
    const query = db
      .select()
      .from(emailActivity)
      .where(and(...whereConditions))
      .orderBy(desc(emailActivity.occurredAt));
    
    if (limit) {
      query.limit(limit);
    }
    
    return await query;
  }

  async getActivityByWebhookId(webhookId: string, tenantId: string): Promise<EmailActivity | undefined> {
    const [activity] = await db
      .select()
      .from(emailActivity)
      .where(and(
        eq(emailActivity.webhookId, webhookId),
        eq(emailActivity.tenantId, tenantId)
      ));
    return activity;
  }

  async getExistingEmailOpenByEmailId(emailId: string, tenantId: string): Promise<EmailActivity | undefined> {
    const [activity] = await db
      .select()
      .from(emailActivity)
      .where(and(
        eq(emailActivity.activityType, 'opened'),
        eq(emailActivity.tenantId, tenantId),
        sql`JSON_EXTRACT(${emailActivity.activityData}, '$.emailId') = ${emailId} OR JSON_EXTRACT(${emailActivity.activityData}, '$.messageId') = ${emailId}`
      ))
      .limit(1);
    
    return activity;
  }

  async findEmailContactByEmail(email: string): Promise<{ contact: EmailContact; tenantId: string } | undefined> {
    // Normalize email for matching
    const normalizedEmail = email.trim();

    // Try exact match first, then case-insensitive match
    const [result] = await db
      .select({
        contact: emailContacts,
        tenantId: emailContacts.tenantId,
      })
      .from(emailContacts)
      .where(
        or(
          eq(emailContacts.email, normalizedEmail),
          ilike(emailContacts.email, normalizedEmail)
        )
      )
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      contact: result.contact,
      tenantId: result.tenantId,
    };
  }

}

export const storage = new DatabaseStorage();
