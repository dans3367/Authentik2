import { Router } from 'express';
import { generateObject } from 'ai';
import { z } from 'zod';
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware';
import { getProviders, unsplashProvider, type ImageCandidate } from '../services/imageProviders';
import { createNewsletterDraft } from '../utils/createNewsletterDraft';

const router = Router();

const AI_MODEL = 'google/gemini-2.5-flash-lite';
const PLACEHOLDER_SRC = 'https://placehold.co/600x400/e2e8f0/64748b?text=Select+image';

/**
 * Log an error without letting util.inspect crash on it.
 * AI SDK v5 errors can contain getters, streams, or circular refs that
 * throw inside Node's default console.error formatting.
 */
function logSafe(label: string, error: unknown): void {
  const e = error as any;
  const safe = {
    name: e?.name,
    message: e?.message,
    code: e?.code,
    status: e?.status ?? e?.statusCode,
    cause: e?.cause?.message,
  };
  try {
    console.error(label, safe);
    if (e?.stack) console.error(e.stack);
  } catch {
    console.error(label, e?.message || '(unloggable error)');
  }
}

function ensureApiKey(res: any): boolean {
  if (!process.env.AI_GATEWAY_API_KEY) {
    res.status(500).json({ success: false, error: 'AI Gateway API key not configured' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Generate newsletter structure
// ─────────────────────────────────────────────────────────────────────────────

const ImageSlotSchema = z.object({
  kind: z.literal('Image'),
  imageQuery: z.string().min(2).max(60).describe('Short stock-photo search phrase, e.g. "artisan coffee shop counter"'),
  alt: z.string().max(120),
  caption: z.string().max(120).optional(),
});

const HeadingBlockSchema = z.object({
  kind: z.literal('Heading'),
  text: z.string().min(2).max(120),
  level: z.enum(['1', '2', '3']),
  size: z.enum(['s', 'm', 'l', 'xl', 'xxl']),
  align: z.enum(['left', 'center', 'right']),
});

const TextBlockSchema = z.object({
  kind: z.literal('Text'),
  text: z.string().min(2).max(400),
  align: z.enum(['left', 'center', 'right']).default('left'),
});

const RichTextBlockSchema = z.object({
  kind: z.literal('RichText'),
  html: z.string().min(2).max(2000).describe('Inline HTML using only <p>, <ul>, <ol>, <li>, <strong>, <em>'),
});

const NewsletterStructureSchema = z.object({
  title: z.string().min(3).max(120),
  subject: z.string().min(3).max(160),
  blocks: z
    .array(
      z.discriminatedUnion('kind', [
        HeadingBlockSchema,
        TextBlockSchema,
        RichTextBlockSchema,
        ImageSlotSchema,
      ]),
    )
    .min(7)
    .max(9),
});

type NewsletterStructure = z.infer<typeof NewsletterStructureSchema>;

function uid(prefix = 'ai'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ImageSlotMeta {
  blockId: string;
  imageQuery: string;
  alt: string;
}

function transformToPuckData(structure: NewsletterStructure): { puckData: any; imageSlots: ImageSlotMeta[] } {
  const content: any[] = [];
  const imageSlots: ImageSlotMeta[] = [];

  for (const block of structure.blocks) {
    const id = uid(block.kind.toLowerCase());

    switch (block.kind) {
      case 'Heading':
        content.push({
          type: 'Heading',
          props: { id, text: block.text, level: block.level, size: block.size, align: block.align },
        });
        content.push({ type: 'Space', props: { id: uid('space'), size: '16px', direction: 'vertical' } });
        break;

      case 'Text':
        content.push({
          type: 'Text',
          props: { id, text: block.text, size: 'm', align: block.align, color: 'default' },
        });
        content.push({ type: 'Space', props: { id: uid('space'), size: '16px', direction: 'vertical' } });
        break;

      case 'RichText':
        content.push({ type: 'RichText', props: { id, html: block.html } });
        content.push({ type: 'Space', props: { id: uid('space'), size: '24px', direction: 'vertical' } });
        break;

      case 'Image':
        content.push({
          type: 'Image',
          props: {
            id,
            images: [{ src: PLACEHOLDER_SRC, alt: block.alt }],
            align: 'center',
            sizing: 'fill',
            borderRadius: 8,
            caption: block.caption || '',
            imageQuery: block.imageQuery,
            aiGenerated: true,
          },
        });
        content.push({ type: 'Space', props: { id: uid('space'), size: '24px', direction: 'vertical' } });
        imageSlots.push({ blockId: id, imageQuery: block.imageQuery, alt: block.alt });
        break;
    }
  }

  const puckData = {
    root: { props: { title: structure.title } },
    zones: {},
    content,
  };

  return { puckData, imageSlots };
}

router.post('/generate-structure', authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const { prompt, tone } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Prompt is required (min 3 chars)' });
    }

    if (!ensureApiKey(res)) return;

    const toneInstruction =
      tone === 'formal'
        ? 'Use a formal, professional tone.'
        : tone === 'casual'
        ? 'Use a casual, friendly, conversational tone.'
        : tone === 'persuasive'
        ? 'Use a persuasive, compelling tone that motivates action.'
        : 'Use a warm, professional tone.';

    const instructions = `You are a professional newsletter writer. Given a topic, produce a structured email newsletter.

Topic:
"""
${prompt}
"""

RULES:
- ${toneInstruction}
- Output exactly 7 blocks in this order: Heading, Text, Image, Text, Image, Text, Image.
  (Valid alternatives: add one extra Text or RichText section between images, up to 9 blocks total. The first block MUST be Heading and there MUST be exactly 3 Image blocks.)
- The first block is a Heading (level="1", size="xl" or "xxl").
- Each Text/RichText block contains 1–3 sentences of real newsletter body copy (no placeholders, no "lorem ipsum").
- RichText html may use <p>, <ul>, <ol>, <li>, <strong>, <em> only — no inline styles, no <div>, no <img>.
- For each Image block, provide an "imageQuery" that is a concrete, visual, 2–6 word stock-photo search phrase tied to the preceding section's content (e.g. "barista pouring latte art", "sunny storefront awning"). Also provide a concise "alt".
- Subject line: compelling and under 80 chars. Title: a newsletter-name style headline.
- Do not include unsubscribe links, greetings, or signatures — just the body blocks.`;

    const { object } = await generateObject({
      model: AI_MODEL,
      schema: NewsletterStructureSchema,
      prompt: instructions,
    });

    // Enforce the exactly-3-images invariant that the schema can't express directly.
    const imageCount = object.blocks.filter((b) => b.kind === 'Image').length;
    if (object.blocks[0].kind !== 'Heading' || imageCount !== 3) {
      return res.status(502).json({
        success: false,
        error: 'AI returned an invalid structure. Please try again.',
      });
    }

    const { puckData, imageSlots } = transformToPuckData(object);

    res.json({
      success: true,
      title: object.title,
      subject: object.subject,
      puckData,
      imageSlots,
    });
  } catch (error: any) {
    logSafe('generate-structure error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to generate newsletter structure' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Image suggestions (Unsplash)
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  candidates: ImageCandidate[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const searchCache = new Map<string, CacheEntry>();

async function searchCached(query: string, count: number): Promise<ImageCandidate[]> {
  const key = query.trim().toLowerCase();
  const now = Date.now();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > now && cached.candidates.length >= count) {
    return cached.candidates.slice(0, count);
  }

  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('No stock image providers configured. Set UNSPLASH_ACCESS_KEY.');
  }

  const results = await Promise.allSettled(providers.map((p) => p.search(query, count)));
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const cand of result.value) {
      const dedupeKey = `${cand.provider}:${cand.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      candidates.push(cand);
    }
  }

  if (searchCache.size >= CACHE_MAX) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { candidates, expiresAt: now + CACHE_TTL_MS });

  return candidates.slice(0, count);
}

const SlotQuerySchema = z.object({
  blockId: z.string().min(1),
  imageQuery: z.string().min(2).max(100),
});

const ImageSuggestionsBodySchema = z.object({
  slots: z.array(SlotQuerySchema).min(1).max(5),
  perSlot: z.number().int().min(1).max(18).optional(),
});

router.post('/image-suggestions', authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const parsed = ImageSuggestionsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid request' });
    }

    const { slots, perSlot = 3 } = parsed.data;

    const results = await Promise.all(
      slots.map(async ({ blockId, imageQuery }) => {
        try {
          const candidates = await searchCached(imageQuery, perSlot);
          return { blockId, candidates, error: null as string | null };
        } catch (error: any) {
          return { blockId, candidates: [] as ImageCandidate[], error: error?.message || 'Search failed' };
        }
      }),
    );

    res.json({ success: true, results });
  } catch (error: any) {
    logSafe('image-suggestions error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch image suggestions' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Finalize — apply selections + create draft
// ─────────────────────────────────────────────────────────────────────────────

const SelectionSchema = z.object({
  blockId: z.string().min(1),
  imageUrl: z.string().url(),
  alt: z.string().max(200).optional().default(''),
  attribution: z
    .object({
      name: z.string().max(120),
      profileUrl: z.string().url().optional(),
    })
    .optional(),
});

const FinalizeBodySchema = z.object({
  title: z.string().min(3).max(120),
  subject: z.string().min(3).max(160),
  puckData: z.object({
    root: z.any(),
    zones: z.any().optional(),
    content: z.array(z.any()),
  }),
  selections: z.array(SelectionSchema).min(1),
  editor: z.enum(['classic', 'notion']).optional().default('classic'),
});

/**
 * Defensive scrubber: drop any "Photo by … (on Unsplash|Pexels)" attribution that
 * might have leaked into the body — whether emitted as a <figcaption>, a stand-alone
 * paragraph, or generated by the model inside body copy. Notion newsletters never
 * show stock-photo credits.
 */
function stripPhotoCredits(html: string): string {
  if (!html) return html;
  let out = html;
  // <figcaption>…Photo by …</figcaption>
  out = out.replace(/<figcaption[^>]*>[^<]*photo\s+by[^<]*<\/figcaption>/gi, '');
  // <figure>…</figure> wrappers that became empty after the figcaption removal
  out = out.replace(/<figure[^>]*>\s*(<img[^>]*>)\s*<\/figure>/gi, '<p>$1</p>');
  // <p>Photo by … (on Unsplash|on Pexels)?</p>
  out = out.replace(/<p[^>]*>\s*Photo\s+by\s+[^<]*?<\/p>/gi, '');
  // inline trailing "Photo by … on Unsplash" sentences left at the end of a paragraph
  out = out.replace(/\s*(?:—|–|-|·|\|)?\s*Photo\s+by\s+[^<.]*?(?:\s+on\s+(?:Unsplash|Pexels))?\s*(?=<\/p>|<br\s*\/?>)/gi, '');
  return out;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert Puck-style content blocks produced by the AI wizard into the inline HTML
 * the Notion-like (Tiptap) editor parses on mount. Image selections are already
 * applied to puckData, so we just read from each block's props.
 */
function puckDataToNotionHtml(puckData: any): string {
  const blocks: any[] = Array.isArray(puckData?.content) ? puckData.content : [];
  const parts: string[] = [];

  for (const block of blocks) {
    const type = block?.type;
    const props = block?.props || {};

    switch (type) {
      case 'Heading': {
        const text = escapeHtml(String(props.text ?? ''));
        if (!text) break;
        const lvl = props.level === '2' ? 2 : props.level === '3' ? 3 : 1;
        parts.push(`<h${lvl}>${text}</h${lvl}>`);
        break;
      }
      case 'Text': {
        const text = escapeHtml(String(props.text ?? ''));
        if (!text) break;
        const align = ['left', 'center', 'right'].includes(props.align) ? props.align : null;
        parts.push(align && align !== 'left'
          ? `<p style="text-align: ${align}">${text}</p>`
          : `<p>${text}</p>`);
        break;
      }
      case 'RichText': {
        const html = typeof props.html === 'string' ? props.html : '';
        if (html.trim()) parts.push(html);
        break;
      }
      case 'Image': {
        const first = Array.isArray(props.images) ? props.images[0] : null;
        const src = first?.src;
        if (!src || src === PLACEHOLDER_SRC) break;
        const alt = escapeHtml(String(first?.alt ?? ''));
        parts.push(`<p><img src="${escapeHtml(src)}" alt="${alt}" /></p>`);
        break;
      }
      // Spacers are skipped — paragraph margins handle spacing in the Notion editor.
      default:
        break;
    }
  }

  return parts.join('\n');
}

function applySelectionsToPuckData(
  puckData: any,
  selections: z.infer<typeof SelectionSchema>[],
  options: { includeCaption?: boolean } = {},
): any {
  const { includeCaption = true } = options;
  const byId = new Map(selections.map((s) => [s.blockId, s]));
  const nextContent = (puckData.content as any[]).map((block) => {
    if (block?.type !== 'Image') return block;
    const sel = byId.get(block.props?.id);
    if (!sel) return block;

    const caption = includeCaption
      ? (sel.attribution?.name
          ? `Photo by ${sel.attribution.name} on Unsplash`
          : block.props?.caption || '')
      : '';

    return {
      ...block,
      props: {
        ...block.props,
        images: [{ src: sel.imageUrl, alt: sel.alt || block.props?.images?.[0]?.alt || '' }],
        caption,
      },
    };
  });

  return { ...puckData, content: nextContent };
}

router.post('/finalize', authenticateToken, requireTenant, requirePermission('newsletters.create'), async (req: any, res) => {
  try {
    const parsed = FinalizeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid request' });
    }

    const { title, subject, puckData, selections, editor } = parsed.data;

    const isNotion = editor === 'notion';
    const updatedPuckData = applySelectionsToPuckData(puckData, selections, {
      includeCaption: !isNotion,
    });

    const rawNotionHtml = isNotion ? puckDataToNotionHtml(updatedPuckData) : '';
    const notionHtml = isNotion ? stripPhotoCredits(rawNotionHtml) : '';
    const storedPuckData = isNotion ? { notionHtml } : updatedPuckData;

    const { newsletter } = await createNewsletterDraft({
      tenantId: req.user.tenantId,
      userEmail: req.user.email,
      shopId: req.shopId || null,
      title,
      subject,
      puckData: storedPuckData,
      content: isNotion ? notionHtml : '',
      emailType: 'newsletter',
      req,
    });

    res.status(201).json({
      success: true,
      newsletterId: newsletter.id,
      editUrl: `/newsletter/create/${newsletter.id}?editor=${isNotion ? 'notion' : 'classic'}`,
    });
  } catch (error: any) {
    logSafe('finalize error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to finalize newsletter' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Direct Unsplash search (replaces client-side VITE_ACCESS_KEY usage)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/unsplash-search', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const perPage = Math.max(1, Math.min(Number(req.query.per_page ?? 12), 30));

    if (!q) {
      return res.status(400).json({ success: false, error: 'Query "q" is required' });
    }

    if (!unsplashProvider.isConfigured()) {
      return res.status(500).json({ success: false, error: 'Unsplash is not configured' });
    }

    const results = await unsplashProvider.search(q, perPage);
    res.json({ success: true, results });
  } catch (error: any) {
    logSafe('unsplash-search error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Unsplash search failed' });
  }
});

export default router;
