import { Router } from "express";
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';
import { getOrCreateTranslation, getTranslations, invalidateTranslationCache, LANGUAGE_NAMES } from '../utils/translationService';
import { createRateLimiter } from '../middleware/security';
import { db } from '../db';
import { newsletters } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const translationRoutes = Router();

// Supported language codes (keys of LANGUAGE_NAMES)
const SUPPORTED_LANGUAGES = new Set(Object.keys(LANGUAGE_NAMES));

// Rate limiter for AI translation endpoint (expensive operation)
const translationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 translation requests per minute per IP
});

// GET /api/newsletters/:id/translations
// List all cached translations for a newsletter
translationRoutes.get("/:id/translations", authenticateToken, requireTenant, requirePermission('newsletters.view'), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verify newsletter belongs to tenant and is not soft-deleted
    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId),
        isNull(newsletters.deletedAt),
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    const translations = await getTranslations(id);

    // Derive source language from the first translation record, or fall back to user's language
    const sourceLanguage = translations[0]?.sourceLanguage || req.user.language || 'en';

    res.json({
      newsletterId: id,
      sourceLanguage,
      translations: translations.map(t => ({
        id: t.id,
        targetLanguage: t.targetLanguage,
        languageName: LANGUAGE_NAMES[t.targetLanguage] || t.targetLanguage,
        translatedSubject: t.translatedSubject,
        contentHash: t.contentHash,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get translations error:', error);
    res.status(500).json({ message: 'Failed to get translations' });
  }
});

// POST /api/newsletters/:id/translations/translate
// Translate a newsletter into a specific language (or re-translate if stale)
translationRoutes.post("/:id/translations/translate", authenticateToken, requireTenant, requirePermission('newsletters.send'), translationRateLimiter, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { targetLanguage, sourceLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({ message: 'targetLanguage is required' });
    }

    // Validate targetLanguage against supported languages
    if (!SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return res.status(400).json({
        message: `Unsupported target language: ${targetLanguage}`,
        supportedLanguages: Array.from(SUPPORTED_LANGUAGES),
      });
    }

    // Validate sourceLanguage if provided
    if (sourceLanguage && !SUPPORTED_LANGUAGES.has(sourceLanguage)) {
      return res.status(400).json({
        message: `Unsupported source language: ${sourceLanguage}`,
        supportedLanguages: Array.from(SUPPORTED_LANGUAGES),
      });
    }

    // Verify newsletter belongs to tenant and is not soft-deleted
    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId),
        isNull(newsletters.deletedAt),
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    const result = await getOrCreateTranslation({
      tenantId: req.user.tenantId,
      newsletterId: id,
      sourceLanguage: sourceLanguage || req.user.language || 'en',
      targetLanguage,
      subject: newsletter.subject,
      content: newsletter.content,
    });

    res.json({
      newsletterId: id,
      targetLanguage: result.targetLanguage,
      languageName: LANGUAGE_NAMES[result.targetLanguage] || result.targetLanguage,
      translatedSubject: result.translatedSubject,
      cached: result.cached,
    });
  } catch (error) {
    console.error('Translate newsletter error:', error);
    res.status(500).json({ message: 'Failed to translate newsletter' });
  }
});

// DELETE /api/newsletters/:id/translations
// Invalidate all cached translations for a newsletter
translationRoutes.delete("/:id/translations", authenticateToken, requireTenant, requirePermission('newsletters.send'), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verify newsletter belongs to tenant and is not soft-deleted
    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId),
        isNull(newsletters.deletedAt),
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    await invalidateTranslationCache(id);

    res.json({ message: 'Translation cache invalidated', newsletterId: id });
  } catch (error) {
    console.error('Invalidate translations error:', error);
    res.status(500).json({ message: 'Failed to invalidate translations' });
  }
});

// GET /api/newsletters/translation-languages
// List all supported languages for newsletter translation
translationRoutes.get("/translation-languages", authenticateToken, requireTenant, async (_req: any, res) => {
  res.json({
    languages: Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name })),
  });
});
