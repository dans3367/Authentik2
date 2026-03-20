import { generateText } from "ai";
import { createHash } from "crypto";
import { db } from "../db";
import { newsletterTranslations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// AI model for translation — same gateway as aiRoutes.ts
const AI_MODEL = 'google/gemini-2.5-flash-lite';

// Language display names for prompts
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
  pt: "Portuguese (Português)",
  it: "Italian (Italiano)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  zh: "Chinese (中文)",
  ar: "Arabic (العربية)",
  hi: "Hindi (हिन्दी)",
  ru: "Russian (Русский)",
};

/**
 * Generate a SHA-256 hash of the source content for cache invalidation.
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Translate HTML newsletter content to a target language using the AI gateway.
 * Preserves all HTML structure, inline styles, template variables ({{first_name}} etc.),
 * and only translates visible text.
 */
async function translateHtml(html: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
  const targetName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const sourceName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;

  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not configured — cannot translate newsletter content");
  }

  const prompt = `You are a professional translator specializing in email marketing content. Translate the following HTML email newsletter from ${sourceName} to ${targetName}.

CRITICAL RULES:
1. Translate ONLY the visible text content — headings, paragraphs, links text, button text, list items, alt text
2. PRESERVE all HTML tags, attributes, inline styles, class names, and structure EXACTLY as-is
3. PRESERVE all template variables like {{first_name}}, {{last_name}}, {{email}}, {{phone}}, {{address}}, {{office_hours}} — do NOT translate these
4. PRESERVE all URLs, href values, src values, and data attributes unchanged
5. PRESERVE all HTML comments unchanged (e.g. <!-- Footer -->)
6. Make the translation natural and culturally appropriate for ${targetName} speakers
7. Maintain the same warm, professional tone as the original
8. Return ONLY the translated HTML — no explanations, no markdown code fences, no backticks
9. The output must be valid HTML that can be used directly as email content

HTML TO TRANSLATE:
${html}`;

  const { text } = await generateText({
    model: AI_MODEL,
    prompt,
  });

  return text.trim();
}

/**
 * Translate an email subject line to a target language.
 */
async function translateSubject(subject: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
  const targetName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const sourceName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;

  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not configured — cannot translate newsletter subject");
  }

  const prompt = `Translate the following email subject line from ${sourceName} to ${targetName}. Keep the same tone and impact. Return ONLY the translated subject line — no explanations, no quotes, no markdown.

SUBJECT: ${subject}`;

  const { text } = await generateText({
    model: AI_MODEL,
    prompt,
  });

  return text.trim();
}

export interface TranslationResult {
  targetLanguage: string;
  translatedSubject: string;
  translatedContent: string;
  cached: boolean;
}

/**
 * Get or create a translation for a newsletter in a specific language.
 * Uses the newsletter_translations table as a cache — only re-translates if source content has changed.
 */
export async function getOrCreateTranslation(opts: {
  tenantId: string;
  newsletterId: string;
  sourceLanguage?: string;
  targetLanguage: string;
  subject: string;
  content: string;
}): Promise<TranslationResult> {
  const { tenantId, newsletterId, sourceLanguage = 'en', targetLanguage, subject, content } = opts;

  // If target === source, return original content
  if (targetLanguage === sourceLanguage) {
    return {
      targetLanguage,
      translatedSubject: subject,
      translatedContent: content,
      cached: true,
    };
  }

  const currentHash = hashContent(subject + content);

  // Check cache
  const cached = await db.query.newsletterTranslations.findFirst({
    where: and(
      eq(newsletterTranslations.newsletterId, newsletterId),
      eq(newsletterTranslations.targetLanguage, targetLanguage),
    ),
  });

  if (cached && cached.contentHash === currentHash) {
    console.log(`[Translation] Cache hit for newsletter ${newsletterId} → ${targetLanguage}`);
    return {
      targetLanguage,
      translatedSubject: cached.translatedSubject,
      translatedContent: cached.translatedContent,
      cached: true,
    };
  }

  // Cache miss or stale — translate
  console.log(`[Translation] Translating newsletter ${newsletterId} → ${targetLanguage} (${cached ? 'stale' : 'new'})`);

  const [translatedSubject, translatedContent] = await Promise.all([
    translateSubject(subject, targetLanguage, sourceLanguage),
    translateHtml(content, targetLanguage, sourceLanguage),
  ]);

  // Upsert into cache
  if (cached) {
    await db.update(newsletterTranslations)
      .set({
        translatedSubject,
        translatedContent,
        contentHash: currentHash,
        sourceLanguage,
        updatedAt: new Date(),
      })
      .where(eq(newsletterTranslations.id, cached.id));
  } else {
    await db.insert(newsletterTranslations).values({
      tenantId,
      newsletterId,
      sourceLanguage,
      targetLanguage,
      translatedSubject,
      translatedContent,
      contentHash: currentHash,
    });
  }

  console.log(`[Translation] Successfully translated newsletter ${newsletterId} → ${targetLanguage}`);

  return {
    targetLanguage,
    translatedSubject,
    translatedContent,
    cached: false,
  };
}

/**
 * Pre-translate a newsletter into all required languages based on recipient preferences.
 * Returns a Map of language code → { subject, content }.
 */
export async function translateNewsletterForRecipients(opts: {
  tenantId: string;
  newsletterId: string;
  sourceLanguage?: string;
  subject: string;
  content: string;
  recipientLanguages: string[];
}): Promise<Map<string, { subject: string; content: string }>> {
  const { tenantId, newsletterId, sourceLanguage = 'en', subject, content, recipientLanguages } = opts;

  // Deduplicate languages and exclude source language
  const uniqueLanguages = Array.from(new Set(recipientLanguages)).filter(Boolean);

  const translationMap = new Map<string, { subject: string; content: string }>();

  // Always include source language content
  translationMap.set(sourceLanguage, { subject, content });

  // Translate to each required target language
  const targetLanguages = uniqueLanguages.filter(lang => lang !== sourceLanguage);

  if (targetLanguages.length === 0) {
    console.log(`[Translation] All recipients use source language (${sourceLanguage}), no translation needed`);
    return translationMap;
  }

  console.log(`[Translation] Translating newsletter ${newsletterId} into ${targetLanguages.length} language(s): ${targetLanguages.join(', ')}`);

  // Translate sequentially to avoid overwhelming the AI gateway
  for (const targetLang of targetLanguages) {
    try {
      const result = await getOrCreateTranslation({
        tenantId,
        newsletterId,
        sourceLanguage,
        targetLanguage: targetLang,
        subject,
        content,
      });

      translationMap.set(targetLang, {
        subject: result.translatedSubject,
        content: result.translatedContent,
      });
    } catch (error) {
      console.error(`[Translation] Failed to translate to ${targetLang}, will use source language as fallback:`, error);
      // Fallback: use source content for this language
      translationMap.set(targetLang, { subject, content });
    }
  }

  return translationMap;
}

/**
 * Delete all cached translations for a newsletter (e.g., when content is updated).
 */
export async function invalidateTranslationCache(newsletterId: string): Promise<void> {
  await db.delete(newsletterTranslations)
    .where(eq(newsletterTranslations.newsletterId, newsletterId));
  console.log(`[Translation] Invalidated translation cache for newsletter ${newsletterId}`);
}

/**
 * Get all cached translations for a newsletter.
 */
export async function getTranslations(newsletterId: string) {
  return db.query.newsletterTranslations.findMany({
    where: eq(newsletterTranslations.newsletterId, newsletterId),
  });
}

export { LANGUAGE_NAMES };
