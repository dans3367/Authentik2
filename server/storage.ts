import {
  betterAuthUser,
  betterAuthAccount,
  subscriptionPlans,
  subscriptions,
  tenants,
  tenantLimits,
  shopLimitEvents,
  forms,
  formResponses,
  verificationTokens,
  refreshTokens,
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
  emailSends,
  bouncedEmails,
  type User,
  type InsertUser,
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
  type CreateEmailActivityData,
  type BouncedEmail,
  type InsertBouncedEmail,
  type CreateBouncedEmailData,
  type UpdateBouncedEmailData,
  type BouncedEmailWithDetails,
  type BouncedEmailFilters,
  type TenantLimits,
  type CreateTenantLimitsData,
  type UpdateTenantLimitsData,
  type TenantLimitsWithDetails,
  type ShopLimitEvent,
  type ShopLimitEventType,
  type ShopLimitFilters,
  promotions,
  type Promotion,
  type CreatePromotionData,
  type UpdatePromotionData,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, lt, gte, lte, desc, ne, or, ilike, count, sql, inArray, not, isNull } from "drizzle-orm";
import { storageLogger } from "./logger";

export interface IStorage {
  // Tenant management
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: CreateTenantData): Promise<Tenant>;
  updateTenant(id: string, updates: UpdateTenantData): Promise<Tenant | undefined>;

  // Owner and tenant creation
  createOwnerAndTenant(ownerData: RegisterOwnerData): Promise<{ owner: User; tenant: Tenant }>;

  // Tenant owner management
  getTenantOwner(tenantId: string): Promise<User | undefined>;

  // Cross-tenant user lookup
  findUserByEmailAcrossTenants(email: string): Promise<(User & { tenant: { id: string; name: string; slug: string } }) | undefined>;

  // User management
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>, tenantId: string): Promise<User | undefined>;

  // Admin user management
  getAllUsers(tenantId: string, filters?: UserFilters): Promise<User[]>;
  getUserStats(tenantId: string): Promise<{ totalUsers: number; activeUsers: number; usersByRole: Record<string, number> }>;
  createUserAsAdmin(userData: CreateUserData, tenantId: string): Promise<User>;
  updateUserAsAdmin(id: string, userData: UpdateUserData, tenantId: string): Promise<User | undefined>;
  deleteUser(id: string, tenantId: string): Promise<void>;
  toggleUserStatus(id: string, isActive: boolean, tenantId: string): Promise<User | undefined>;
  getManagerUsers(tenantId: string): Promise<User[]>;

  // Email verification
  setEmailVerificationToken(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<void>;
  getUserByEmailVerificationToken(token: string, tenantId?: string): Promise<User | undefined>;
  verifyUserEmail(userId: string, tenantId: string): Promise<void>;
  updateLastVerificationEmailSent(userId: string, tenantId: string): Promise<void>;

  // Form management
  createForm(formData: CreateFormData, userId: string, tenantId: string): Promise<Form>;
  getForm(id: string, tenantId: string): Promise<Form | undefined>;
  getPublicForm(id: string): Promise<Form | undefined>;
  getUserForms(userId: string, tenantId: string): Promise<Form[]>;
  getTenantForms(tenantId: string): Promise<FormWithDetails[]>;
  updateForm(id: string, updates: UpdateFormData, tenantId: string): Promise<Form | undefined>;
  deleteForm(id: string, tenantId: string): Promise<void>;

  // Form response management
  submitFormResponse(responseData: SubmitFormResponseData, tenantId: string): Promise<FormResponse>;
  getFormResponses(formId: string, tenantId: string): Promise<FormResponse[]>;
  getFormResponseCount(formId: string, tenantId: string): Promise<number>;

  // Subscription plan management
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;

  // Subscription management
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(id: string, tenantId?: string): Promise<Subscription | undefined>;
  getUserSubscription(userId: string, tenantId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, updates: Partial<Subscription>, tenantId?: string): Promise<Subscription | undefined>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string, tenantId: string): Promise<void>;

  // Tenant subscription and limits
  getTenantSubscription(tenantId: string): Promise<(Subscription & { plan: SubscriptionPlan }) | undefined>;
  checkUserLimits(tenantId: string): Promise<{ canAddUser: boolean; currentUsers: number; maxUsers: number | null; planName: string }>;
  validateUserCreation(tenantId: string): Promise<void>;
  checkShopLimits(tenantId: string): Promise<{ canAddShop: boolean; currentShops: number; maxShops: number | null; planName: string; isCustomLimit?: boolean; customLimitReason?: string; expiresAt?: Date }>;
  validateShopCreation(tenantId: string): Promise<void>;
  logShopLimitEvent(tenantId: string, eventType: ShopLimitEventType, shopCount: number, limitValue?: number, metadata?: Record<string, any>): Promise<void>;
  createTenantLimits(tenantId: string, limitsData: CreateTenantLimitsData, createdBy: string): Promise<TenantLimits>;
  updateTenantLimits(tenantId: string, updates: UpdateTenantLimitsData): Promise<TenantLimits | undefined>;
  getTenantLimits(tenantId: string): Promise<TenantLimitsWithDetails | undefined>;
  deleteTenantLimits(tenantId: string): Promise<void>;
  getCurrentShopCount(tenantId: string): Promise<number>;
  getShopLimitEvents(tenantId: string, filters?: ShopLimitFilters): Promise<ShopLimitEvent[]>;

  // Tenant plan (effective plan with feature flags)
  getTenantPlan(tenantId: string): Promise<{ planName: string; maxUsers: number | null; maxShops: number | null; monthlyEmailLimit: number | null; allowUsersManagement: boolean; allowRolesManagement: boolean; subscriptionStatus: string | null }>;

  // Email limits
  checkEmailLimits(tenantId: string): Promise<{ canSend: boolean; currentUsage: number; monthlyLimit: number | null; planName: string; remaining: number | null }>;
  validateEmailSending(tenantId: string, count?: number): Promise<void>;

  // Shop management
  getShop(id: string, tenantId: string): Promise<Shop | undefined>;
  getShopWithManager(id: string, tenantId: string): Promise<ShopWithManager | undefined>;
  getAllShops(tenantId: string, filters?: ShopFilters): Promise<ShopWithManager[]>;
  getShopsByManager(managerId: string, tenantId: string): Promise<Shop[]>;
  createShop(shop: CreateShopData, tenantId: string): Promise<Shop>;
  updateShop(id: string, updates: UpdateShopData, tenantId: string): Promise<Shop | undefined>;
  deleteShop(id: string, tenantId: string): Promise<void>;
  toggleShopStatus(id: string, isActive: boolean, tenantId: string): Promise<Shop | undefined>;

  // Email contact management
  getEmailContact(id: string, tenantId: string): Promise<EmailContact | undefined>;
  getEmailContactWithDetails(id: string, tenantId: string): Promise<EmailContactWithDetails | undefined>;
  getAllEmailContacts(tenantId: string, filters?: ContactFilters): Promise<EmailContactWithDetails[]>;
  createEmailContact(contact: CreateEmailContactData, tenantId: string): Promise<EmailContact>;
  updateEmailContact(id: string, updates: UpdateEmailContactData, tenantId: string): Promise<EmailContact | undefined>;
  deleteEmailContact(id: string, tenantId: string): Promise<void>;
  bulkDeleteEmailContacts(ids: string[], tenantId: string): Promise<void>;

  // Email list management
  getEmailList(id: string, tenantId: string): Promise<EmailList | undefined>;
  getAllEmailLists(tenantId: string): Promise<EmailListWithCount[]>;
  createEmailList(list: CreateEmailListData, tenantId: string): Promise<EmailList>;
  updateEmailList(id: string, name: string, description: string | undefined, tenantId: string): Promise<EmailList | undefined>;
  deleteEmailList(id: string, tenantId: string): Promise<void>;

  // Contact tag management
  getContactTag(id: string, tenantId: string): Promise<ContactTag | undefined>;
  getAllContactTags(tenantId: string): Promise<ContactTag[]>;
  createContactTag(tag: CreateContactTagData, tenantId: string): Promise<ContactTag>;
  updateContactTag(id: string, name: string, color: string, tenantId: string): Promise<ContactTag | undefined>;
  deleteContactTag(id: string, tenantId: string): Promise<void>;

  // Contact list membership
  addContactToList(contactId: string, listId: string, tenantId: string): Promise<void>;
  removeContactFromList(contactId: string, listId: string, tenantId: string): Promise<void>;
  getContactLists(contactId: string, tenantId: string): Promise<EmailList[]>;
  bulkAddContactsToList(contactIds: string[], listId: string, tenantId: string): Promise<void>;

  // Contact tag assignment
  addTagToContact(contactId: string, tagId: string, tenantId: string): Promise<void>;
  removeTagFromContact(contactId: string, tagId: string, tenantId: string): Promise<void>;
  getContactTags(contactId: string, tenantId: string): Promise<ContactTag[]>;
  bulkAddTagToContacts(contactIds: string[], tagId: string, tenantId: string): Promise<void>;

  // Statistics
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

  // Newsletter management
  getNewsletter(id: string, tenantId: string): Promise<Newsletter | undefined>;
  getNewsletterById(id: string): Promise<Newsletter | undefined>;
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

  // Newsletter task status
  getNewsletterTaskStatuses(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]>;
  createNewsletterTaskStatus(newsletterId: string, taskData: CreateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus>;
  updateNewsletterTaskStatus(id: string, updates: UpdateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus | undefined>;
  deleteNewsletterTaskStatus(id: string, tenantId: string): Promise<void>;
  initializeNewsletterTasks(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]>;

  // Campaign management
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

  // Email activity tracking
  createEmailActivity(activityData: CreateEmailActivityData, tenantId: string): Promise<EmailActivity>;
  getEmailActivity(id: string, tenantId: string): Promise<EmailActivity | undefined>;
  getContactActivity(contactId: string, tenantId: string, limit?: number, fromDate?: Date, toDate?: Date): Promise<EmailActivity[]>;
  getActivityByWebhookId(webhookId: string, tenantId: string): Promise<EmailActivity | undefined>;
  hasContactOpenedNewsletter(contactId: string, newsletterId: string, tenantId: string): Promise<boolean>;
  findEmailContactByEmail(email: string): Promise<{ contact: EmailContact; tenantId: string } | undefined>;

  // Bounced email management
  addBouncedEmail(bouncedEmailData: CreateBouncedEmailData): Promise<BouncedEmail>;
  updateBouncedEmail(email: string, updates: UpdateBouncedEmailData): Promise<BouncedEmail | undefined>;
  getBouncedEmail(email: string): Promise<BouncedEmail | undefined>;
  isEmailBounced(email: string): Promise<boolean>;
  getAllBouncedEmails(filters?: BouncedEmailFilters): Promise<BouncedEmail[]>;
  removeBouncedEmail(email: string): Promise<void>;
  getBouncedEmailAddresses(): Promise<string[]>;
  incrementBounceCount(email: string, lastBouncedAt: Date, bounceReason?: string): Promise<BouncedEmail | undefined>;

  // Promotion management
  getPromotion(id: string, tenantId: string): Promise<Promotion | undefined>;
  getAllPromotions(tenantId: string): Promise<Promotion[]>;
  createPromotion(promotion: CreatePromotionData, userId: string, tenantId: string): Promise<Promotion>;
  updatePromotion(id: string, updates: UpdatePromotionData, tenantId: string): Promise<Promotion | undefined>;
  deletePromotion(id: string, tenantId: string): Promise<void>;
  getPromotionStats(tenantId: string): Promise<{
    totalPromotions: number;
    activePromotions: number;
    monthlyUsage: number;
    totalReach: number;
  }>;
  incrementPromotionUsage(id: string, tenantId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Tenant management methods
  async getTenant(id: string): Promise<Tenant | undefined> {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id)
    });
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug)
    });
    return tenant;
  }

  async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: UpdateTenantData): Promise<Tenant | undefined> {
    const [tenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  // Owner and tenant creation
  async createOwnerAndTenant(ownerData: RegisterOwnerData): Promise<{ owner: User; tenant: Tenant }> {
    return await db.transaction(async (tx: any) => {
      // Create the tenant first
      const [tenant] = await tx.insert(tenants).values({
        name: ownerData.organizationName,
        slug: ownerData.organizationSlug,
        isActive: true,
        maxUsers: 10, // Default max users for new organizations
      }).returning();

      // Create the owner user
      const name = ownerData.firstName && ownerData.lastName
        ? `${ownerData.firstName} ${ownerData.lastName}`
        : ownerData.firstName || ownerData.lastName || ownerData.email;

      const [owner] = await tx.insert(betterAuthUser).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: ownerData.email,
        name,
        firstName: ownerData.firstName,
        lastName: ownerData.lastName,
        role: 'Owner',
        isActive: true,
        emailVerified: false, // Owner still needs to verify email
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return { owner, tenant };
    });
  }

  // Tenant owner management
  async getTenantOwner(tenantId: string): Promise<User | undefined> {
    const owner = await db.query.betterAuthUser.findFirst({
      where: and(eq(betterAuthUser.tenantId, tenantId), eq(betterAuthUser.role, 'Owner'))
    });
    return owner;
  }

  // Cross-tenant user lookup
  async findUserByEmailAcrossTenants(email: string): Promise<(User & { tenant: { id: string; name: string; slug: string } }) | undefined> {
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email),
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    return user;
  }

  // User management methods (tenant-aware)
  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const user = await db.query.betterAuthUser.findFirst({
      where: and(eq(betterAuthUser.id, id), eq(betterAuthUser.tenantId, tenantId))
    });
    return user;
  }

  async getUserByEmail(email: string, tenantId: string): Promise<User | undefined> {
    const user = await db.query.betterAuthUser.findFirst({
      where: and(eq(betterAuthUser.email, email), eq(betterAuthUser.tenantId, tenantId))
    });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(betterAuthUser)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(betterAuthUser.id, id), eq(betterAuthUser.tenantId, tenantId)))
      .returning();
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Construct name from firstName and lastName if not provided
    const name = insertUser.name ||
      (insertUser.firstName && insertUser.lastName
        ? `${insertUser.firstName} ${insertUser.lastName}`
        : insertUser.firstName || insertUser.lastName || insertUser.email);

    const userId = crypto.randomUUID();
    const [user] = await db
      .insert(betterAuthUser)
      .values({
        ...insertUser,
        name,
        id: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create Better Auth credential account so the user can log in with email/password
    if ((insertUser as any).password) {
      const { hashPassword } = await import('better-auth/crypto');
      const hashedPassword = await hashPassword((insertUser as any).password);
      await db.insert(betterAuthAccount).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ [Storage] Created credential account for user ${insertUser.email}`);
    }

    return user;
  }



  // User management methods (tenant-aware)
  async getAllUsers(tenantId: string, filters?: UserFilters): Promise<User[]> {
    const conditions = [eq(betterAuthUser.tenantId, tenantId)];

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(betterAuthUser.firstName, searchTerm),
          ilike(betterAuthUser.lastName, searchTerm),
          ilike(betterAuthUser.email, searchTerm)
        )!
      );
    }

    if (filters?.role) {
      conditions.push(eq(betterAuthUser.role, filters.role));
    }

    if (filters?.status === 'active') {
      conditions.push(eq(betterAuthUser.isActive, true));
    } else if (filters?.status === 'inactive') {
      conditions.push(eq(betterAuthUser.isActive, false));
    } else if (!filters?.showInactive) {
      conditions.push(eq(betterAuthUser.isActive, true));
    }

    const whereClause = and(...conditions);

    const result = await db
      .select()
      .from(betterAuthUser)
      .where(whereClause)
      .orderBy(desc(betterAuthUser.createdAt));

    return result;
  }

  async getUserStats(tenantId: string): Promise<{ totalUsers: number; activeUsers: number; usersByRole: Record<string, number> }> {
    const totalUsersResult = await db.select({ count: count() }).from(betterAuthUser).where(eq(betterAuthUser.tenantId, tenantId));
    const activeUsersResult = await db.select({ count: count() }).from(betterAuthUser).where(and(eq(betterAuthUser.tenantId, tenantId), eq(betterAuthUser.isActive, true)));
    const usersByRoleResult = await db.select({ role: betterAuthUser.role, count: count() }).from(betterAuthUser).where(eq(betterAuthUser.tenantId, tenantId)).groupBy(betterAuthUser.role);

    const totalUsers = totalUsersResult[0]?.count || 0;
    const activeUsers = activeUsersResult[0]?.count || 0;

    const usersByRole: Record<string, number> = {};
    usersByRoleResult.forEach((row: any) => {
      if (row.role) {
        usersByRole[row.role] = row.count;
      }
    });

    return {
      totalUsers,
      activeUsers,
      usersByRole
    };
  }

  async createUserAsAdmin(userData: CreateUserData, tenantId: string): Promise<User> {
    // Construct name from firstName and lastName
    const name = userData.firstName && userData.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : userData.firstName || userData.lastName || userData.email;

    const userId = crypto.randomUUID();
    const [user] = await db.insert(betterAuthUser).values({
      ...userData,
      name,
      tenantId,
      id: userId,
      emailVerified: userData.emailVerified ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Create Better Auth credential account so the user can log in with email/password
    if (userData.password) {
      const { hashPassword } = await import('better-auth/crypto');
      const hashedPassword = await hashPassword(userData.password);
      await db.insert(betterAuthAccount).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ [Storage] Created credential account for admin-created user ${userData.email}`);
    }

    return user;
  }

  async updateUserAsAdmin(id: string, userData: UpdateUserData, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(betterAuthUser)
      .set({ ...userData, updatedAt: new Date() })
      .where(and(eq(betterAuthUser.id, id), eq(betterAuthUser.tenantId, tenantId)))
      .returning();
    return user;
  }

  async deleteUser(id: string, tenantId: string): Promise<void> {
    // Delete refresh tokens first
    await db.delete(refreshTokens).where(and(eq(refreshTokens.userId, id), eq(refreshTokens.tenantId, tenantId)));
    // Delete user
    await db.delete(betterAuthUser).where(and(eq(betterAuthUser.id, id), eq(betterAuthUser.tenantId, tenantId)));
  }

  async toggleUserStatus(id: string, isActive: boolean, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .update(betterAuthUser)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(betterAuthUser.id, id), eq(betterAuthUser.tenantId, tenantId)))
      .returning();
    return user;
  }

  async getManagerUsers(tenantId: string): Promise<User[]> {
    const result = await db
      .select()
      .from(betterAuthUser)
      .where(
        and(
          eq(betterAuthUser.tenantId, tenantId),
          or(
            eq(betterAuthUser.role, 'Manager'),
            eq(betterAuthUser.role, 'Administrator'),
            eq(betterAuthUser.role, 'Owner')
          )
        )
      );
    return result;
  }

  // Email verification methods
  async setEmailVerificationToken(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<void> {
    await db.update(betterAuthUser)
      .set({
        emailVerificationToken: token,
        emailVerificationExpires: expiresAt,
        lastVerificationEmailSent: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)));
  }

  async getUserByEmailVerificationToken(token: string, tenantId?: string): Promise<User | undefined> {
    const user = await db.query.betterAuthUser.findFirst({
      where: tenantId ?
        and(eq(betterAuthUser.emailVerificationToken, token), eq(betterAuthUser.tenantId, tenantId)) :
        eq(betterAuthUser.emailVerificationToken, token)
    });
    return user;
  }

  async verifyUserEmail(userId: string, tenantId: string): Promise<void> {
    await db.update(betterAuthUser)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date()
      })
      .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)));
  }

  async updateLastVerificationEmailSent(userId: string, tenantId: string): Promise<void> {
    await db.update(betterAuthUser)
      .set({
        lastVerificationEmailSent: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)));
  }

  // Subscription and limits
  async getTenantSubscription(tenantId: string): Promise<(Subscription & { plan: SubscriptionPlan }) | undefined> {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
      with: {
        plan: true
      }
    });
    return subscription;
  }

  async getTenantPlan(tenantId: string): Promise<{ planName: string; maxUsers: number | null; maxShops: number | null; monthlyEmailLimit: number | null; allowUsersManagement: boolean; allowRolesManagement: boolean; subscriptionStatus: string | null }> {
    const subscription = await this.getTenantSubscription(tenantId);

    if (subscription) {
      return {
        planName: subscription.plan.displayName || subscription.plan.name,
        maxUsers: subscription.plan.maxUsers,
        maxShops: subscription.plan.maxShops,
        monthlyEmailLimit: subscription.plan.monthlyEmailLimit,
        allowUsersManagement: subscription.plan.allowUsersManagement ?? false,
        allowRolesManagement: subscription.plan.allowRolesManagement ?? false,
        subscriptionStatus: subscription.status,
      };
    }

    // No subscription — return Free plan defaults
    const freePlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, 'Free')).limit(1);
    if (freePlan.length > 0) {
      return {
        planName: freePlan[0].displayName,
        maxUsers: freePlan[0].maxUsers,
        maxShops: freePlan[0].maxShops,
        monthlyEmailLimit: freePlan[0].monthlyEmailLimit,
        allowUsersManagement: freePlan[0].allowUsersManagement ?? false,
        allowRolesManagement: freePlan[0].allowRolesManagement ?? false,
        subscriptionStatus: null,
      };
    }

    // Hardcoded Free fallback if no plan record exists
    return {
      planName: 'Free Plan',
      maxUsers: 1,
      maxShops: 0,
      monthlyEmailLimit: 100,
      allowUsersManagement: false,
      allowRolesManagement: false,
      subscriptionStatus: null,
    };
  }

  async checkUserLimits(tenantId: string): Promise<{ canAddUser: boolean; currentUsers: number; maxUsers: number | null; planName: string }> {
    // Get current total user count for the tenant (count all users including inactive)
    const userCountResult = await db
      .select({ count: count() })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId));

    const currentUsers = userCountResult[0]?.count || 0;

    // Get tenant's subscription and plan limits
    const subscription = await this.getTenantSubscription(tenantId);

    if (!subscription) {
      // No subscription found - use Free plan limits as default
      const freePlan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, 'Free'))
        .limit(1);

      const maxUsers = freePlan[0]?.maxUsers ?? 1; // Default to 1 user for Free plan

      return {
        canAddUser: currentUsers < maxUsers,
        currentUsers,
        maxUsers,
        planName: 'Free'
      };
    }

    const maxUsers = subscription.plan.maxUsers;
    const planName = subscription.plan.name;

    return {
      canAddUser: maxUsers === null || currentUsers < maxUsers,
      currentUsers,
      maxUsers,
      planName
    };
  }

  async validateUserCreation(tenantId: string): Promise<void> {
    const limits = await this.checkUserLimits(tenantId);

    if (!limits.canAddUser) {
      throw new Error(`User limit reached. Current plan (${limits.planName}) allows ${limits.maxUsers} users, and you currently have ${limits.currentUsers} users.`);
    }
  }

  // Form management methods
  async createForm(formData: CreateFormData, userId: string, tenantId: string): Promise<Form> {
    const [form] = await db.insert(forms).values({
      ...formData,
      userId,
      tenantId,
      updatedAt: new Date(),
    }).returning();
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
    return await db.select().from(forms)
      .where(eq(forms.tenantId, tenantId))
      .orderBy(desc(forms.createdAt)) as FormWithDetails[];
  }

  async updateForm(id: string, updates: UpdateFormData, tenantId: string): Promise<Form | undefined> {
    const [form] = await db.update(forms)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)))
      .returning();
    return form;
  }

  async deleteForm(id: string, tenantId: string): Promise<void> {
    await db.delete(forms).where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)));
  }

  // Form response methods
  async submitFormResponse(responseData: SubmitFormResponseData, tenantId: string): Promise<FormResponse> {
    const [response] = await db.insert(formResponses).values({
      ...responseData,
      tenantId,
    }).returning();
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

  // Subscription plan methods
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  // Subscription methods
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db.insert(subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getSubscription(id: string, tenantId?: string): Promise<Subscription | undefined> {
    const conditions = [eq(subscriptions.id, id)];
    if (tenantId) conditions.push(eq(subscriptions.tenantId, tenantId));
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
    if (tenantId) conditions.push(eq(subscriptions.tenantId, tenantId));
    const [subscription] = await db.update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return subscription;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string, tenantId: string): Promise<void> {
    await db.update(betterAuthUser)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      })
      .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)));
  }

  // Enhanced shop limits and validation with tenant-specific overrides
  async checkShopLimits(tenantId: string): Promise<{ canAddShop: boolean; currentShops: number; maxShops: number | null; planName: string; isCustomLimit?: boolean; customLimitReason?: string; expiresAt?: Date }> {
    const shopsResult = await db.select({ count: count() }).from(shops).where(eq(shops.tenantId, tenantId));
    const currentShops = shopsResult[0]?.count || 0;

    // Check for active custom tenant limits first
    const customLimit = await db.query.tenantLimits.findFirst({
      where: and(
        eq(tenantLimits.tenantId, tenantId),
        eq(tenantLimits.isActive, true),
        or(
          isNull(tenantLimits.expiresAt),
          gt(tenantLimits.expiresAt, new Date())
        )
      ),
      with: {
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      }
    });

    if (customLimit && customLimit.maxShops !== null) {
      return {
        canAddShop: currentShops < customLimit.maxShops,
        currentShops,
        maxShops: customLimit.maxShops,
        planName: 'Custom Limit',
        isCustomLimit: true,
        customLimitReason: customLimit.overrideReason || undefined,
        expiresAt: customLimit.expiresAt || undefined
      };
    }

    // Fall back to subscription plan limits
    const subscription = await this.getTenantSubscription(tenantId);

    if (!subscription) {
      return {
        canAddShop: false,
        currentShops,
        maxShops: 0,
        planName: 'Free Plan',
        isCustomLimit: false
      };
    }

    const maxShops = subscription.plan.maxShops;
    return {
      canAddShop: maxShops === null || currentShops < maxShops,
      currentShops,
      maxShops,
      planName: subscription.plan.displayName || subscription.plan.name,
      isCustomLimit: false
    };
  }

  async validateShopCreation(tenantId: string): Promise<void> {
    const limits = await this.checkShopLimits(tenantId);
    if (!limits.canAddShop) {
      const limitType = limits.isCustomLimit ? 'custom limit' : 'current plan';
      const expiryInfo = limits.expiresAt ? ` (expires ${limits.expiresAt.toLocaleDateString()})` : '';
      throw new Error(`Shop limit reached. Your ${limitType} allows ${limits.maxShops} shops${expiryInfo}.`);
    }
  }

  // Email limits checking
  async checkEmailLimits(tenantId: string): Promise<{ canSend: boolean; currentUsage: number; monthlyLimit: number | null; planName: string; remaining: number | null }> {
    // 1. Get stats
    const subscription = await this.getTenantSubscription(tenantId);

    // Determine the start of the current period
    let periodStart = new Date();
    periodStart.setDate(1); // Default to start of current month
    periodStart.setHours(0, 0, 0, 0);

    if (subscription && subscription.currentPeriodStart) {
      // Use subscription period if available
      periodStart = new Date(subscription.currentPeriodStart);
    }

    // Count emails sent in this period
    const usageResult = await db.select({ count: count() })
      .from(emailSends)
      .where(and(
        eq(emailSends.tenantId, tenantId),
        gte(emailSends.createdAt, periodStart)
      ));

    const currentUsage = usageResult[0]?.count || 0;

    // 2. Determine limits
    // Check for custom tenant limits first
    const customLimit = await db.query.tenantLimits.findFirst({
      where: and(
        eq(tenantLimits.tenantId, tenantId),
        eq(tenantLimits.isActive, true),
        or(
          isNull(tenantLimits.expiresAt),
          gt(tenantLimits.expiresAt, new Date())
        )
      )
    });

    let monthlyLimit: number | null = 100; // Default fallback (Free plan)
    let planName = 'Free Plan';

    if (customLimit && customLimit.monthlyEmailLimit !== null && customLimit.monthlyEmailLimit !== undefined) {
      monthlyLimit = customLimit.monthlyEmailLimit;
      planName = 'Custom Limit';
    } else if (subscription) {
      monthlyLimit = subscription.plan.monthlyEmailLimit;
      planName = subscription.plan.displayName;
    } else {
      // No subscription and no custom limit -> check if there's a Free plan in DB to get official limit
      const freePlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, 'Free')).limit(1);
      if (freePlan.length > 0) {
        monthlyLimit = freePlan[0].monthlyEmailLimit;
        planName = freePlan[0].displayName;
      }
    }

    // 3. Compare
    // If limit is null, it means unlimited (though our schema default is 200, so likely not null unless explicitly set to null for "unlimited")
    // For now assuming null = unlimited

    const canSend = monthlyLimit === null || currentUsage < monthlyLimit;
    const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - currentUsage);

    return {
      canSend,
      currentUsage,
      monthlyLimit,
      planName,
      remaining
    };
  }

  async validateEmailSending(tenantId: string, count: number = 1): Promise<void> {
    const limits = await this.checkEmailLimits(tenantId);

    if (limits.monthlyLimit !== null && (limits.currentUsage + count) > limits.monthlyLimit) {
      throw new Error(`Email sending limit reached. Your plan (${limits.planName}) allows ${limits.monthlyLimit} emails per month. You have sent ${limits.currentUsage} so far.`);
    }
  }

  // Log shop limit events for audit and analytics
  async logShopLimitEvent(tenantId: string, eventType: ShopLimitEventType, shopCount: number, limitValue?: number, metadata?: Record<string, any>): Promise<void> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);
      const customLimit = await db.query.tenantLimits.findFirst({
        where: and(
          eq(tenantLimits.tenantId, tenantId),
          eq(tenantLimits.isActive, true)
        )
      });

      await db.insert(shopLimitEvents).values({
        tenantId,
        eventType,
        shopCount,
        limitValue,
        subscriptionPlanId: subscription?.planId || null,
        customLimitId: customLimit?.id || null,
        metadata: JSON.stringify(metadata || {})
      });
    } catch (error) {
      console.error('Failed to log shop limit event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  // Tenant limits management
  async createTenantLimits(tenantId: string, limitsData: CreateTenantLimitsData, createdBy: string): Promise<TenantLimits> {
    const [tenantLimit] = await db.insert(tenantLimits).values({
      ...limitsData,
      tenantId,
      createdBy,
    }).returning();

    // Log the limit change event
    if (limitsData.maxShops !== undefined) {
      const currentShops = await this.getCurrentShopCount(tenantId);
      await this.logShopLimitEvent(tenantId, 'limit_increased', currentShops, limitsData.maxShops, {
        reason: limitsData.overrideReason,
        createdBy
      });
    }

    return tenantLimit;
  }

  async updateTenantLimits(tenantId: string, updates: UpdateTenantLimitsData): Promise<TenantLimits | undefined> {
    const [updated] = await db.update(tenantLimits)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantLimits.tenantId, tenantId))
      .returning();

    // Log the limit change event
    if (updated && updates.maxShops !== undefined) {
      const currentShops = await this.getCurrentShopCount(tenantId);
      const eventType = updates.maxShops > (updated.maxShops || 0) ? 'limit_increased' : 'limit_decreased';
      await this.logShopLimitEvent(tenantId, eventType, currentShops, updates.maxShops);
    }

    return updated;
  }

  async getTenantLimits(tenantId: string): Promise<TenantLimitsWithDetails | undefined> {
    const result = await db.query.tenantLimits.findFirst({
      where: eq(tenantLimits.tenantId, tenantId),
      with: {
        createdByUser: true
      }
    });

    // Transform the result to match the expected type
    if (result) {
      return {
        ...result,
        createdByUser: result.createdByUser || undefined
      } as TenantLimitsWithDetails;
    }

    return result;
  }

  async deleteTenantLimits(tenantId: string): Promise<void> {
    await db.delete(tenantLimits).where(eq(tenantLimits.tenantId, tenantId));
  }

  // Helper method to get current shop count
  async getCurrentShopCount(tenantId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(shops).where(eq(shops.tenantId, tenantId));
    return result[0]?.count || 0;
  }

  // Get shop limit events for analytics
  async getShopLimitEvents(tenantId: string, filters?: ShopLimitFilters): Promise<ShopLimitEvent[]> {
    const conditions = [eq(shopLimitEvents.tenantId, tenantId)];

    if (filters?.eventType) {
      conditions.push(eq(shopLimitEvents.eventType, filters.eventType));
    }

    if (filters?.fromDate) {
      conditions.push(gte(shopLimitEvents.createdAt, filters.fromDate));
    }

    if (filters?.toDate) {
      conditions.push(lte(shopLimitEvents.createdAt, filters.toDate));
    }

    return await db.select().from(shopLimitEvents)
      .where(and(...conditions))
      .orderBy(desc(shopLimitEvents.createdAt));
  }

  // Shop management methods
  async getShop(id: string, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops)
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)));
    return shop;
  }

  async getShopWithManager(id: string, tenantId: string): Promise<ShopWithManager | undefined> {
    const [shop] = await db.select().from(shops)
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)));
    return shop as ShopWithManager;
  }

  async getAllShops(tenantId: string, filters?: ShopFilters): Promise<ShopWithManager[]> {
    const conditions = [eq(shops.tenantId, tenantId)];
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(shops.status, filters.status));
    }
    return await db.select().from(shops)
      .where(and(...conditions))
      .orderBy(desc(shops.createdAt)) as ShopWithManager[];
  }

  async getShopsByManager(managerId: string, tenantId: string): Promise<Shop[]> {
    return db.select().from(shops)
      .where(and(eq(shops.managerId, managerId), eq(shops.tenantId, tenantId)));
  }

  async createShop(shopData: CreateShopData, tenantId: string): Promise<Shop> {
    await this.validateShopCreation(tenantId);
    const [shop] = await db.insert(shops).values({
      ...shopData,
      tenantId,
      updatedAt: new Date(),
    }).returning();

    // Log shop creation event
    const currentShops = await this.getCurrentShopCount(tenantId);
    const limits = await this.checkShopLimits(tenantId);
    await this.logShopLimitEvent(tenantId, 'shop_created', currentShops, limits.maxShops || undefined, {
      shopId: shop.id,
      shopName: shop.name
    });

    return shop;
  }

  async updateShop(id: string, updates: UpdateShopData, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db.update(shops)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)))
      .returning();
    return shop;
  }

  async deleteShop(id: string, tenantId: string): Promise<void> {
    await db.delete(shops).where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)));
  }

  async toggleShopStatus(id: string, isActive: boolean, tenantId: string): Promise<Shop | undefined> {
    const [shop] = await db.update(shops)
      .set({ isActive, status: isActive ? 'active' : 'inactive', updatedAt: new Date() })
      .where(and(eq(shops.id, id), eq(shops.tenantId, tenantId)))
      .returning();
    return shop;
  }

  // Email contact methods
  async getEmailContact(id: string, tenantId: string): Promise<EmailContact | undefined> {
    const [contact] = await db.select().from(emailContacts)
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)));
    return contact;
  }

  async getEmailContactWithDetails(id: string, tenantId: string): Promise<EmailContactWithDetails | undefined> {
    const contact = await this.getEmailContact(id, tenantId);
    if (!contact) return undefined;
    return contact as EmailContactWithDetails;
  }

  async getAllEmailContacts(tenantId: string, filters?: ContactFilters): Promise<EmailContactWithDetails[]> {
    const conditions = [eq(emailContacts.tenantId, tenantId)];
    if (filters?.search) {
      conditions.push(or(
        ilike(emailContacts.email, `%${filters.search}%`),
        ilike(emailContacts.firstName, `%${filters.search}%`),
        ilike(emailContacts.lastName, `%${filters.search}%`)
      )!);
    }
    return await db.select().from(emailContacts)
      .where(and(...conditions))
      .orderBy(desc(emailContacts.createdAt)) as EmailContactWithDetails[];
  }

  async createEmailContact(contactData: CreateEmailContactData, tenantId: string): Promise<EmailContact> {
    const [contact] = await db.insert(emailContacts).values({
      ...contactData,
      tenantId,
    }).returning();
    return contact;
  }

  async updateEmailContact(id: string, updates: UpdateEmailContactData, tenantId: string): Promise<EmailContact | undefined> {
    const [contact] = await db.update(emailContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)))
      .returning();
    return contact;
  }

  async deleteEmailContact(id: string, tenantId: string): Promise<void> {
    await db.delete(emailContacts)
      .where(and(eq(emailContacts.id, id), eq(emailContacts.tenantId, tenantId)));
  }

  async bulkDeleteEmailContacts(ids: string[], tenantId: string): Promise<void> {
    await db.delete(emailContacts)
      .where(and(eq(emailContacts.tenantId, tenantId), inArray(emailContacts.id, ids)));
  }

  // Email list methods
  async getEmailList(id: string, tenantId: string): Promise<EmailList | undefined> {
    const [list] = await db.select().from(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
    return list;
  }

  async getAllEmailLists(tenantId: string): Promise<EmailListWithCount[]> {
    return await db.select().from(emailLists)
      .where(eq(emailLists.tenantId, tenantId))
      .orderBy(emailLists.name) as EmailListWithCount[];
  }

  async createEmailList(listData: CreateEmailListData, tenantId: string): Promise<EmailList> {
    const [list] = await db.insert(emailLists).values({
      ...listData,
      tenantId,
    }).returning();
    return list;
  }

  async updateEmailList(id: string, name: string, description: string | undefined, tenantId: string): Promise<EmailList | undefined> {
    const [list] = await db.update(emailLists)
      .set({ name, description, updatedAt: new Date() })
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)))
      .returning();
    return list;
  }

  async deleteEmailList(id: string, tenantId: string): Promise<void> {
    await db.delete(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
  }

  // Contact tag methods
  async getContactTag(id: string, tenantId: string): Promise<ContactTag | undefined> {
    const [tag] = await db.select().from(contactTags)
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)));
    return tag;
  }

  async getAllContactTags(tenantId: string): Promise<ContactTag[]> {
    return await db.select().from(contactTags)
      .where(eq(contactTags.tenantId, tenantId))
      .orderBy(contactTags.name);
  }

  async createContactTag(tagData: CreateContactTagData, tenantId: string): Promise<ContactTag> {
    const [tag] = await db.insert(contactTags).values({
      ...tagData,
      tenantId,
    }).returning();
    return tag;
  }

  async updateContactTag(id: string, name: string, color: string, tenantId: string): Promise<ContactTag | undefined> {
    const [tag] = await db.update(contactTags)
      .set({ name, color })
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)))
      .returning();
    return tag;
  }

  async deleteContactTag(id: string, tenantId: string): Promise<void> {
    await db.delete(contactTags)
      .where(and(eq(contactTags.id, id), eq(contactTags.tenantId, tenantId)));
  }

  // Contact list membership methods
  async addContactToList(contactId: string, listId: string, tenantId: string): Promise<void> {
    await db.insert(contactListMemberships).values({
      contactId,
      listId,
      tenantId,
    }).onConflictDoNothing();
  }

  async removeContactFromList(contactId: string, listId: string, tenantId: string): Promise<void> {
    await db.delete(contactListMemberships)
      .where(and(
        eq(contactListMemberships.contactId, contactId),
        eq(contactListMemberships.listId, listId),
        eq(contactListMemberships.tenantId, tenantId)
      ));
  }

  async getContactLists(contactId: string, tenantId: string): Promise<EmailList[]> {
    const result = await db.select({
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
    const values = contactIds.map(contactId => ({ contactId, listId, tenantId }));
    await db.insert(contactListMemberships).values(values).onConflictDoNothing();
  }

  // Contact tag assignment methods
  async addTagToContact(contactId: string, tagId: string, tenantId: string): Promise<void> {
    await db.insert(contactTagAssignments).values({
      contactId,
      tagId,
      tenantId,
    }).onConflictDoNothing();
  }

  async removeTagFromContact(contactId: string, tagId: string, tenantId: string): Promise<void> {
    await db.delete(contactTagAssignments)
      .where(and(
        eq(contactTagAssignments.contactId, contactId),
        eq(contactTagAssignments.tagId, tagId),
        eq(contactTagAssignments.tenantId, tenantId)
      ));
  }

  async getContactTags(contactId: string, tenantId: string): Promise<ContactTag[]> {
    const result = await db.select({
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
    const values = contactIds.map(contactId => ({ contactId, tagId, tenantId }));
    await db.insert(contactTagAssignments).values(values).onConflictDoNothing();
  }

  // Statistics methods
  async getEmailContactStats(tenantId: string): Promise<{
    totalContacts: number;
    activeContacts: number;
    unsubscribedContacts: number;
    bouncedContacts: number;
    pendingContacts: number;
    totalLists: number;
    averageEngagementRate: number;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(emailContacts).where(eq(emailContacts.tenantId, tenantId));
    const [activeResult] = await db.select({ count: count() }).from(emailContacts).where(and(eq(emailContacts.tenantId, tenantId), eq(emailContacts.status, 'active')));
    const [listsResult] = await db.select({ count: count() }).from(emailLists).where(eq(emailLists.tenantId, tenantId));

    return {
      totalContacts: totalResult.count,
      activeContacts: activeResult.count,
      unsubscribedContacts: 0,
      bouncedContacts: 0,
      pendingContacts: 0,
      totalLists: listsResult.count,
      averageEngagementRate: 0,
    };
  }

  async getShopStats(tenantId: string): Promise<{ totalShops: number; activeShops: number; shopsByCategory: Record<string, number> }> {
    const [totalResult] = await db.select({ count: count() }).from(shops).where(eq(shops.tenantId, tenantId));
    const [activeResult] = await db.select({ count: count() }).from(shops).where(and(eq(shops.tenantId, tenantId), eq(shops.isActive, true)));

    return {
      totalShops: totalResult.count,
      activeShops: activeResult.count,
      shopsByCategory: {},
    };
  }

  // Newsletter methods
  async getNewsletter(id: string, tenantId: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db.select().from(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)));
    return newsletter;
  }

  async getNewsletterById(id: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, id));
    return newsletter;
  }

  async getAllEmailContactsDebug(): Promise<{ email: string; tenantId: string; id: string }[]> {
    return await db.select({
      id: emailContacts.id,
      email: emailContacts.email,
      tenantId: emailContacts.tenantId,
    }).from(emailContacts).limit(50);
  }

  async getNewsletterWithUser(id: string, tenantId: string): Promise<NewsletterWithUser | undefined> {
    const newsletter = await this.getNewsletter(id, tenantId);
    if (!newsletter) return undefined;
    return newsletter as NewsletterWithUser;
  }

  async getAllNewsletters(tenantId: string): Promise<NewsletterWithUser[]> {
    return await db.select().from(newsletters)
      .where(eq(newsletters.tenantId, tenantId))
      .orderBy(desc(newsletters.createdAt)) as NewsletterWithUser[];
  }

  async createNewsletter(newsletterData: CreateNewsletterData, userId: string, tenantId: string): Promise<Newsletter> {
    const [newsletter] = await db.insert(newsletters).values({
      ...newsletterData,
      userId,
      tenantId,
    }).returning();
    return newsletter;
  }

  async updateNewsletter(id: string, updates: UpdateNewsletterData, tenantId: string): Promise<Newsletter | undefined> {
    const [newsletter] = await db.update(newsletters)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)))
      .returning();
    return newsletter;
  }

  async deleteNewsletter(id: string, tenantId: string): Promise<void> {
    await db.delete(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.tenantId, tenantId)));
  }

  async getNewsletterStats(tenantId: string): Promise<{
    totalNewsletters: number;
    draftNewsletters: number;
    scheduledNewsletters: number;
    sentNewsletters: number;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(newsletters).where(eq(newsletters.tenantId, tenantId));
    return {
      totalNewsletters: totalResult.count,
      draftNewsletters: 0,
      scheduledNewsletters: 0,
      sentNewsletters: 0,
    };
  }

  // Newsletter task status methods
  async getNewsletterTaskStatuses(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]> {
    return await db.select().from(newsletterTaskStatus)
      .where(and(
        eq(newsletterTaskStatus.newsletterId, newsletterId),
        eq(newsletterTaskStatus.tenantId, tenantId)
      ));
  }

  async createNewsletterTaskStatus(newsletterId: string, taskData: CreateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus> {
    const [taskStatus] = await db.insert(newsletterTaskStatus).values({
      ...taskData,
      newsletterId,
      tenantId,
    }).returning();
    return taskStatus;
  }

  async updateNewsletterTaskStatus(id: string, updates: UpdateNewsletterTaskStatusData, tenantId: string): Promise<NewsletterTaskStatus | undefined> {
    const [taskStatus] = await db.update(newsletterTaskStatus)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(newsletterTaskStatus.id, id), eq(newsletterTaskStatus.tenantId, tenantId)))
      .returning();
    return taskStatus;
  }

  async deleteNewsletterTaskStatus(id: string, tenantId: string): Promise<void> {
    await db.delete(newsletterTaskStatus)
      .where(and(eq(newsletterTaskStatus.id, id), eq(newsletterTaskStatus.tenantId, tenantId)));
  }

  async initializeNewsletterTasks(newsletterId: string, tenantId: string): Promise<NewsletterTaskStatus[]> {
    const defaultTasks = [
      { taskType: 'validation' as const, taskName: 'Content Validation', status: 'completed' as const, progress: 100 },
      { taskType: 'processing' as const, taskName: 'Template Processing', status: 'pending' as const, progress: 0 },
      { taskType: 'sending' as const, taskName: 'Email Delivery', status: 'pending' as const, progress: 0 },
      { taskType: 'analytics' as const, taskName: 'Analytics Collection', status: 'pending' as const, progress: 0 },
    ];

    const tasks: NewsletterTaskStatus[] = [];
    for (const task of defaultTasks) {
      const [createdTask] = await db.insert(newsletterTaskStatus).values({
        ...task,
        newsletterId,
        tenantId,
      }).returning();
      tasks.push(createdTask);
    }
    return tasks;
  }

  // Campaign methods
  async getCampaign(id: string, tenantId: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
    return campaign;
  }

  async getAllCampaigns(tenantId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.tenantId, tenantId))
      .orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaignData: CreateCampaignData, userId: string, tenantId: string): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values({
      ...campaignData,
      budget: campaignData.budget?.toString(),
      userId,
      tenantId,
    }).returning();
    return campaign;
  }

  async updateCampaign(id: string, updates: UpdateCampaignData, tenantId: string): Promise<Campaign | undefined> {
    const [campaign] = await db.update(campaigns)
      .set({
        ...updates,
        budget: updates.budget?.toString(),
        updatedAt: new Date()
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
      .returning();
    return campaign;
  }

  async deleteCampaign(id: string, tenantId: string): Promise<void> {
    await db.delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
  }

  async getCampaignStats(tenantId: string): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    draftCampaigns: number;
    completedCampaigns: number;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(campaigns).where(eq(campaigns.tenantId, tenantId));
    return {
      totalCampaigns: totalResult.count,
      activeCampaigns: 0,
      draftCampaigns: 0,
      completedCampaigns: 0,
    };
  }

  // Email activity methods
  async createEmailActivity(activityData: CreateEmailActivityData, tenantId: string): Promise<EmailActivity> {
    const [activity] = await db.insert(emailActivity).values({
      ...activityData,
      tenantId,
    }).returning();
    return activity;
  }

  async getEmailActivity(id: string, tenantId: string): Promise<EmailActivity | undefined> {
    const [activity] = await db.select().from(emailActivity)
      .where(and(eq(emailActivity.id, id), eq(emailActivity.tenantId, tenantId)));
    return activity;
  }

  async getContactActivity(contactId: string, tenantId: string, limit?: number, fromDate?: Date, toDate?: Date): Promise<EmailActivity[]> {
    const conditions = [eq(emailActivity.contactId, contactId), eq(emailActivity.tenantId, tenantId)];
    if (fromDate) conditions.push(gte(emailActivity.occurredAt, fromDate));
    if (toDate) conditions.push(lte(emailActivity.occurredAt, toDate));

    let query = db.select().from(emailActivity)
      .where(and(...conditions))
      .orderBy(desc(emailActivity.occurredAt));

    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getActivityByWebhookId(webhookId: string, tenantId: string): Promise<EmailActivity | undefined> {
    const [activity] = await db.select().from(emailActivity)
      .where(and(eq(emailActivity.webhookId, webhookId), eq(emailActivity.tenantId, tenantId)));
    return activity;
  }

  async hasContactOpenedNewsletter(contactId: string, newsletterId: string, tenantId: string): Promise<boolean> {
    const [activity] = await db.select().from(emailActivity)
      .where(and(
        eq(emailActivity.activityType, 'opened'),
        eq(emailActivity.contactId, contactId),
        eq(emailActivity.newsletterId, newsletterId),
        eq(emailActivity.tenantId, tenantId)
      ))
      .limit(1);
    return !!activity;
  }

  async findEmailContactByEmail(email: string): Promise<{ contact: EmailContact; tenantId: string } | undefined> {
    const [result] = await db.select().from(emailContacts)
      .where(eq(emailContacts.email, email.toLowerCase().trim()))
      .limit(1);

    if (!result) return undefined;
    return { contact: result, tenantId: result.tenantId };
  }

  // Bounced email methods
  async addBouncedEmail(bouncedEmailData: CreateBouncedEmailData): Promise<BouncedEmail> {
    const [bouncedEmail] = await db.insert(bouncedEmails).values({
      ...bouncedEmailData,
      email: bouncedEmailData.email.toLowerCase().trim(),
    }).returning();
    return bouncedEmail;
  }

  async updateBouncedEmail(email: string, updates: UpdateBouncedEmailData): Promise<BouncedEmail | undefined> {
    const [updated] = await db.update(bouncedEmails)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bouncedEmails.email, email.toLowerCase().trim()))
      .returning();
    return updated;
  }

  async getBouncedEmail(email: string): Promise<BouncedEmail | undefined> {
    const [bouncedEmail] = await db.select().from(bouncedEmails)
      .where(eq(bouncedEmails.email, email.toLowerCase().trim()));
    return bouncedEmail;
  }

  async isEmailBounced(email: string): Promise<boolean> {
    const [result] = await db.select({ id: bouncedEmails.id }).from(bouncedEmails)
      .where(and(
        eq(bouncedEmails.email, email.toLowerCase().trim()),
        eq(bouncedEmails.isActive, true)
      ))
      .limit(1);
    return !!result;
  }

  async getAllBouncedEmails(filters?: BouncedEmailFilters): Promise<BouncedEmail[]> {
    const conditions = [];
    if (filters?.search) conditions.push(ilike(bouncedEmails.email, `%${filters.search}%`));
    if (filters?.bounceType && filters.bounceType !== 'all') conditions.push(eq(bouncedEmails.bounceType, filters.bounceType));
    if (filters?.isActive !== undefined) conditions.push(eq(bouncedEmails.isActive, filters.isActive));

    return await db.select().from(bouncedEmails)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bouncedEmails.lastBouncedAt));
  }

  async removeBouncedEmail(email: string): Promise<void> {
    await db.delete(bouncedEmails)
      .where(eq(bouncedEmails.email, email.toLowerCase().trim()));
  }

  async getBouncedEmailAddresses(): Promise<string[]> {
    const results = await db.select({ email: bouncedEmails.email }).from(bouncedEmails)
      .where(eq(bouncedEmails.isActive, true));
    return results.map((result: any) => result.email);
  }

  async incrementBounceCount(email: string, lastBouncedAt: Date, bounceReason?: string): Promise<BouncedEmail | undefined> {
    const [updated] = await db.update(bouncedEmails)
      .set({
        bounceCount: sql`${bouncedEmails.bounceCount} + 1`,
        lastBouncedAt,
        bounceReason: bounceReason || bouncedEmails.bounceReason,
        updatedAt: new Date(),
      })
      .where(eq(bouncedEmails.email, email.toLowerCase().trim()))
      .returning();
    return updated;
  }

  // Promotion management methods
  async getPromotion(id: string, tenantId: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select()
      .from(promotions)
      .where(and(
        eq(promotions.id, id),
        eq(promotions.tenantId, tenantId)
      ));

    // Parse promotional codes from JSON
    if (promotion && promotion.promotionalCodes) {
      try {
        (promotion as any).promotionalCodes = JSON.parse(promotion.promotionalCodes);
      } catch (e) {
        (promotion as any).promotionalCodes = [];
      }
    }

    return promotion;
  }

  async getAllPromotions(tenantId: string): Promise<Promotion[]> {
    const result = await db.select()
      .from(promotions)
      .where(eq(promotions.tenantId, tenantId))
      .orderBy(desc(promotions.createdAt));

    // Parse promotional codes from JSON for each promotion
    return result.map((promotion: any) => {
      if (promotion.promotionalCodes) {
        try {
          (promotion as any).promotionalCodes = JSON.parse(promotion.promotionalCodes);
        } catch (e) {
          (promotion as any).promotionalCodes = [];
        }
      }
      return promotion;
    });
  }

  async createPromotion(promotion: CreatePromotionData, userId: string, tenantId: string): Promise<Promotion> {
    const [created] = await db.insert(promotions)
      .values({
        ...promotion,
        userId,
        tenantId,
        promotionalCodes: promotion.promotionalCodes ? JSON.stringify(promotion.promotionalCodes) : null,
      })
      .returning();

    // Parse promotional codes back to array for return
    if (created.promotionalCodes) {
      try {
        (created as any).promotionalCodes = JSON.parse(created.promotionalCodes);
      } catch (e) {
        (created as any).promotionalCodes = [];
      }
    }

    return created;
  }

  async updatePromotion(id: string, updates: UpdatePromotionData, tenantId: string): Promise<Promotion | undefined> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Handle promotional codes JSON serialization
    if (updates.promotionalCodes !== undefined) {
      (updateData as any).promotionalCodes = updates.promotionalCodes ? JSON.stringify(updates.promotionalCodes) : null;
    }

    const [updated] = await db.update(promotions)
      .set(updateData)
      .where(and(
        eq(promotions.id, id),
        eq(promotions.tenantId, tenantId)
      ))
      .returning();

    // Parse promotional codes back to array for return
    if (updated && updated.promotionalCodes) {
      try {
        (updated as any).promotionalCodes = JSON.parse(updated.promotionalCodes);
      } catch (e) {
        (updated as any).promotionalCodes = [];
      }
    }

    return updated;
  }

  async deletePromotion(id: string, tenantId: string): Promise<void> {
    await db.delete(promotions)
      .where(and(
        eq(promotions.id, id),
        eq(promotions.tenantId, tenantId)
      ));
  }

  async getPromotionStats(tenantId: string): Promise<{
    totalPromotions: number;
    activePromotions: number;
    monthlyUsage: number;
    totalReach: number;
  }> {
    const [stats] = await db.select({
      totalPromotions: count(promotions.id),
      activePromotions: sql<number>`COUNT(CASE WHEN ${promotions.isActive} = true THEN 1 END)`,
      monthlyUsage: sql<number>`SUM(CASE WHEN ${promotions.createdAt} >= NOW() - INTERVAL '30 days' THEN ${promotions.usageCount} ELSE 0 END)`,
      totalReach: sql<number>`SUM(${promotions.usageCount})`,
    })
      .from(promotions)
      .where(eq(promotions.tenantId, tenantId));

    return {
      totalPromotions: stats.totalPromotions || 0,
      activePromotions: Number(stats.activePromotions) || 0,
      monthlyUsage: Number(stats.monthlyUsage) || 0,
      totalReach: Number(stats.totalReach) || 0,
    };
  }

  async incrementPromotionUsage(id: string, tenantId: string): Promise<void> {
    await db.update(promotions)
      .set({
        usageCount: sql`${promotions.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(promotions.id, id),
        eq(promotions.tenantId, tenantId)
      ));
  }
}

export const storage = new DatabaseStorage();
