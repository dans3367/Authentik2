import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, tenants, betterAuthUser } from "@shared/schema";

const APP_FALLBACK_NAME = process.env.APP_NAME || "SaaS Platform";

const tenantNameCache = new Map<string, string>();

export async function getTenantDisplayName(tenantId?: string | null): Promise<string> {
  if (!tenantId) {
    return APP_FALLBACK_NAME;
  }

  const cached = tenantNameCache.get(tenantId);
  if (cached) {
    return cached;
  }

  let displayName: string | null | undefined;

  try {
    const companyRecord = await db.query.companies.findFirst({
      where: eq(companies.tenantId, tenantId),
      columns: {
        name: true,
      },
    });

    displayName = companyRecord?.name?.trim();

    if (!displayName) {
      const tenantRecord = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: {
          name: true,
        },
      });

      displayName = tenantRecord?.name?.trim();
    }
  } catch (error) {
    console.warn("[emailBranding] Failed to resolve tenant display name", { tenantId, error });
  }

  const resolvedName = displayName && displayName.length > 0 ? displayName : APP_FALLBACK_NAME;
  tenantNameCache.set(tenantId, resolvedName);
  return resolvedName;
}

export async function getTenantBrandingForEmail(email: string): Promise<{ tenantId: string | null; displayName: string }> {
  try {
    const userRecord = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email),
      columns: {
        tenantId: true,
      },
    });

    const tenantId = userRecord?.tenantId || null;
    const displayName = await getTenantDisplayName(tenantId);

    return { tenantId, displayName };
  } catch (error) {
    console.warn("[emailBranding] Failed to resolve branding for email", { email, error });
    return { tenantId: null, displayName: APP_FALLBACK_NAME };
  }
}

export interface EmailBrandingContext {
  tenantId?: string | null;
  userEmail?: string | null;
  explicitName?: string | null;
}

export async function resolveEmailBranding(context: EmailBrandingContext): Promise<{ tenantId: string | null; displayName: string }>
{
  if (context.explicitName && context.explicitName.trim().length > 0) {
    return { tenantId: context.tenantId ?? null, displayName: context.explicitName.trim() };
  }

  if (context.tenantId) {
    const displayName = await getTenantDisplayName(context.tenantId);
    return { tenantId: context.tenantId, displayName };
  }

  if (context.userEmail) {
    return await getTenantBrandingForEmail(context.userEmail);
  }

  return { tenantId: null, displayName: APP_FALLBACK_NAME };
}

export function buildFooterHtml(displayName: string, extraLines: string[] = []): string {
  const lines = [
    `Sent by ${escapeHtml(displayName)} via Authentik`,
    ...extraLines.map(escapeHtml),
  ];

  return `
    <div style="padding: 20px 30px; background-color: #f7fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      ${lines
        .map(
          (line) =>
            `<p style="margin: 4px 0; font-size: 0.85rem; color: #718096; line-height: 1.5;">${line}</p>`
        )
        .join("")}
    </div>
  `;
}

export function buildFooterText(displayName: string, extraLines: string[] = []): string {
  const lines = [`Sent by ${displayName} via Authentik`, ...extraLines];
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
