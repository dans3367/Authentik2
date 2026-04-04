/**
 * Content moderation for newsletter content.
 * Checks for prohibited content patterns: profanity, racism, adult content, violence.
 */

export interface ModerationViolation {
  category: 'profanity' | 'racism' | 'adult_content' | 'violence';
  matchedTerm: string;
  categoryLabel: string;
}

export interface ModerationResult {
  passed: boolean;
  violations: ModerationViolation[];
}

// ── Prohibited word lists by category ──
// Each entry is a regex-ready pattern (matched with word boundaries, case-insensitive)

const PROFANITY_PATTERNS = [
  'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
  'shit', 'shitting', 'shitty', 'bullshit',
  'ass(?:hole)?',
  'bitch', 'bitches',
  'damn(?:it)?',
  'bastard', 'bastards',
  'crap',
  'cunt', 'cunts',
  'dick(?:head)?',
  'piss(?:ed)?',
  'wanker', 'wankers',
  'twat',
  'bollocks',
  'motherfucker', 'motherfucking',
  'douchebag',
  'jackass',
];

const RACISM_PATTERNS = [
  'nigger', 'niggers', 'nigga', 'niggas',
  'chink', 'chinks',
  'spic', 'spics',
  'wetback', 'wetbacks',
  'kike', 'kikes',
  'gook', 'gooks',
  'raghead', 'ragheads',
  'towelhead', 'towelheads',
  'coon', 'coons',
  'darkie', 'darkies',
  'redskin', 'redskins',
  'beaner', 'beaners',
  'white\\s*supremacy', 'white\\s*supremacist',
  'white\\s*power',
  'heil\\s*hitler',
  'sieg\\s*heil',
  'racial\\s*purity',
  'ethnic\\s*cleansing',
];

const ADULT_CONTENT_PATTERNS = [
  'porn(?:ography)?',
  'xxx',
  'hardcore\\s*sex',
  'anal\\s*sex',
  'oral\\s*sex',
  'blowjob', 'blowjobs',
  'handjob', 'handjobs',
  'gangbang',
  'threesome',
  'orgasm',
  'masturbat(?:e|ion|ing)',
  'erotic(?:a)?',
  'nude(?:s)?',
  'naked',
  'stripper', 'strippers',
  'escort\\s*service',
  'cam\\s*girl',
  'onlyfans',
  'fetish',
  'bondage',
  'dildo',
  'vibrator',
  'sex\\s*toy',
  'hentai',
  'milf',
];

const VIOLENCE_PATTERNS = [
  'kill\\s*(?:yourself|yourselves|him|her|them)',
  'murder(?:ing)?',
  'genocide',
  'terrorist', 'terrorism',
  'bomb\\s*threat',
  'mass\\s*shooting',
  'school\\s*shooting',
  'death\\s*threat',
  'i\\s*will\\s*kill',
  'gonna\\s*kill',
  'suicide\\s*bomb',
  'car\\s*bomb',
  'pipe\\s*bomb',
  'shoot\\s*up',
  'stab(?:bing)?\\s*(?:you|him|her|them)',
  'decapitat(?:e|ion)',
  'dismember',
  'torture',
  'mutilat(?:e|ion)',
];

const CATEGORY_LABELS: Record<ModerationViolation['category'], string> = {
  profanity: 'Profanity',
  racism: 'Racist or Discriminatory Language',
  adult_content: 'Adult or Sexual Content',
  violence: 'Violent or Threatening Content',
};

/**
 * Strip HTML tags from content to get plain text for moderation.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check text against a list of patterns for a given category.
 */
function checkPatterns(
  text: string,
  patterns: string[],
  category: ModerationViolation['category'],
): ModerationViolation[] {
  const violations: ModerationViolation[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    const match = regex.exec(text);
    if (match) {
      const term = match[0].toLowerCase();
      if (!seen.has(term)) {
        seen.add(term);
        violations.push({
          category,
          matchedTerm: match[0],
          categoryLabel: CATEGORY_LABELS[category],
        });
      }
    }
  }

  return violations;
}

/**
 * Moderate newsletter content. Checks both subject and HTML body content.
 * Returns a result indicating whether the content passed moderation
 * and any violations found.
 */
export function moderateContent(subject: string, htmlContent: string): ModerationResult {
  const plainText = `${subject} ${stripHtml(htmlContent)}`;

  const violations: ModerationViolation[] = [
    ...checkPatterns(plainText, PROFANITY_PATTERNS, 'profanity'),
    ...checkPatterns(plainText, RACISM_PATTERNS, 'racism'),
    ...checkPatterns(plainText, ADULT_CONTENT_PATTERNS, 'adult_content'),
    ...checkPatterns(plainText, VIOLENCE_PATTERNS, 'violence'),
  ];

  return {
    passed: violations.length === 0,
    violations,
  };
}
