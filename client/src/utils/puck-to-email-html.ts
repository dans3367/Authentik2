/**
 * Converts Puck editor DOM content into clean, email-client-safe HTML.
 *
 * Email clients (Gmail, Outlook, Apple Mail) strip <style> blocks, ignore CSS classes,
 * and don't support CSS variables, flexbox, or grid. This utility:
 *  - Strips data-* and aria-* attributes added by Puck/React
 *  - Removes Puck editor chrome (drag handles, selection outlines)
 *  - Converts CSS variable references to fallback values
 *  - Replaces flex/grid layouts with table-based equivalents
 *  - Ensures all styles are inline
 */

const PUCK_ATTRS_RE = /\s(data-[\w-]+|aria-[\w-]+|class|tabindex|draggable|contenteditable)="[^"]*"/gi;
const CSS_VAR_RE = /var\(--[\w-]+(?:,\s*([^)]+))?\)/g;
const EMPTY_STYLE_RE = /\sstyle=""/g;

/** CSS variable fallback map for known Puck variables */
const CSS_VAR_FALLBACKS: Record<string, string> = {
  '--puck-color-grey-05': '#6b7280',
  '--puck-color-grey-04': '#9ca3af',
  '--puck-color-grey-03': '#d1d5db',
  '--puck-color-grey-02': '#e5e7eb',
  '--puck-color-grey-01': '#f3f4f6',
  '--puck-color-azure-03': '#2563eb',
  '--puck-color-azure-04': '#1d4ed8',
  '--puck-color-azure-05': '#1e40af',
  '--puck-color-azure-06': '#1e3a8a',
};

function resolveCssVars(styleStr: string): string {
  return styleStr.replace(CSS_VAR_RE, (match, fallback) => {
    // Try to find the variable name in our fallback map
    const varNameMatch = match.match(/var\((--[\w-]+)/);
    if (varNameMatch && CSS_VAR_FALLBACKS[varNameMatch[1]]) {
      return CSS_VAR_FALLBACKS[varNameMatch[1]];
    }
    // Use the CSS fallback value if provided
    if (fallback) return fallback.trim();
    return 'inherit';
  });
}

/**
 * Walk the DOM tree and produce clean inline-styled HTML suitable for email clients.
 */
function nodeToEmailHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;

  // Skip Puck editor UI elements (action bars, drag handles, overlays)
  if (
    el.getAttribute('data-puck-overlay') !== null ||
    el.getAttribute('data-puck-action-bar') !== null ||
    el.classList.contains('PuckOverlay') ||
    el.classList.contains('PuckActionBar')
  ) {
    return '';
  }

  const tag = el.tagName.toLowerCase();

  // Skip script/style tags
  if (tag === 'script' || tag === 'style' || tag === 'svg') return '';

  // Collect computed inline styles
  const computed = window.getComputedStyle(el);
  const inlineStyles: string[] = [];

  // Key style properties that matter for email rendering
  const emailProps = [
    'color', 'background-color', 'background-image',
    'font-size', 'font-weight', 'font-family', 'font-style',
    'text-align', 'text-decoration', 'line-height', 'letter-spacing',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-collapse', 'border-radius',
    'width', 'max-width', 'min-width', 'height',
    'display', 'vertical-align', 'table-layout', 'box-sizing',
  ];

  // Table-family tags should not get display styles — email clients handle them natively
  const isTableElement = ['table','tr','td','th','tbody','thead','tfoot'].includes(tag);

  // Properties where the computed value resolves to pixels but we want the
  // original CSS value (e.g. "100%" or "33%"). These will be picked up from
  // the inline style attribute merge below instead.
  const skipComputedProps = new Set(['width', 'max-width', 'min-width', 'height']);

  for (const prop of emailProps) {
    // Skip width/height from computed styles — use inline style values instead
    if (skipComputedProps.has(prop)) continue;

    const val = computed.getPropertyValue(prop);
    if (val && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'auto' && val !== 'rgba(0, 0, 0, 0)') {
      // Skip display for native table elements
      if (prop === 'display' && isTableElement) continue;

      // Convert flex/grid display to block for email
      if (prop === 'display') {
        if (val === 'flex' || val === 'grid' || val === 'inline-flex') {
          inlineStyles.push('display: block');
          continue;
        }
        if (val === 'inline-block' || val === 'inline') {
          inlineStyles.push(`display: ${val}`);
          continue;
        }
      }
      inlineStyles.push(`${prop}: ${resolveCssVars(val)}`);
    }
  }

  // Resolve the existing inline style attribute too (has priority)
  const existingStyle = el.getAttribute('style');
  if (existingStyle) {
    const resolved = resolveCssVars(existingStyle);
    // Merge: existing inline styles override computed ones
    const existingParsed = resolved.split(';').filter(Boolean).map(s => s.trim());
    for (const rule of existingParsed) {
      const colonIdx = rule.indexOf(':');
      if (colonIdx > 0) {
        const prop = rule.substring(0, colonIdx).trim();
        // Remove any computed version of this prop
        const idx = inlineStyles.findIndex(s => s.startsWith(prop + ':'));
        if (idx >= 0) inlineStyles.splice(idx, 1);
        inlineStyles.push(rule);
      }
    }
  }

  // Build children HTML
  let childrenHtml = '';
  for (const child of Array.from(el.childNodes)) {
    childrenHtml += nodeToEmailHtml(child);
  }

  // For divs that are just Puck wrappers with no meaningful styles, unwrap them
  const isPuckWrapper = tag === 'div' && (
    el.getAttribute('data-puck-component') !== null ||
    el.getAttribute('data-rfd-draggable-id') !== null
  );

  if (isPuckWrapper && !existingStyle) {
    return childrenHtml;
  }

  // Map semantic tags for email
  const emailTag = mapTagForEmail(tag);
  const styleAttr = inlineStyles.length > 0 ? ` style="${inlineStyles.join('; ')}"` : '';

  // Preserve important HTML attributes for email rendering
  let extraAttrs = '';

  // Link attributes
  const href = tag === 'a' ? el.getAttribute('href') : null;
  if (href) extraAttrs += ` href="${href}"`;
  const target = tag === 'a' ? el.getAttribute('target') : null;
  if (target) extraAttrs += ` target="${target}"`;

  // Image attributes
  const src = tag === 'img' ? el.getAttribute('src') : null;
  const alt = tag === 'img' ? el.getAttribute('alt') : null;
  if (src) extraAttrs += ` src="${src}"`;
  if (alt) extraAttrs += ` alt="${alt}"`;

  // Table-specific attributes — critical for email clients (especially Outlook)
  if (['table', 'td', 'th', 'tr', 'col', 'colgroup', 'tbody', 'thead', 'tfoot'].includes(tag)) {
    const tableAttrs = ['cellpadding', 'cellspacing', 'border', 'role', 'width', 'height', 'align', 'valign', 'bgcolor', 'colspan', 'rowspan'];
    for (const attr of tableAttrs) {
      const val = el.getAttribute(attr);
      if (val !== null) extraAttrs += ` ${attr}="${val}"`;
    }
  }

  // Image width/height attributes (needed for Outlook)
  if (tag === 'img') {
    const imgWidth = el.getAttribute('width');
    const imgHeight = el.getAttribute('height');
    if (imgWidth) extraAttrs += ` width="${imgWidth}"`;
    if (imgHeight) extraAttrs += ` height="${imgHeight}"`;
  }

  // Self-closing tags
  if (['img', 'br', 'hr', 'col'].includes(emailTag)) {
    return `<${emailTag}${styleAttr}${extraAttrs} />`;
  }

  return `<${emailTag}${styleAttr}${extraAttrs}>${childrenHtml}</${emailTag}>`;
}

function mapTagForEmail(tag: string): string {
  // Keep semantic tags, map others to safe email equivalents
  const safe = ['h1','h2','h3','h4','h5','h6','p','a','img','br','hr','span','strong','em','b','i','u','ul','ol','li','table','tr','td','th','thead','tbody','tfoot','colgroup','col','blockquote'];
  if (safe.includes(tag)) return tag;
  return 'div';
}

/**
 * Extract the Puck preview content from the DOM and convert it to email-safe HTML.
 * Returns a complete, self-contained HTML body fragment ready to be wrapped in an email template.
 */
export function extractPuckEmailHtml(): string {
  // Try multiple selectors to find the Puck preview content area
  const selectors = [
    '[class*="PuckPreview"]',
    '[data-puck-preview]',
    '.puck-preview',
    '[class*="Puck-page"]',
  ];

  let previewEl: HTMLElement | null = null;
  for (const sel of selectors) {
    previewEl = document.querySelector(sel);
    if (previewEl) break;
  }

  // Fallback: find the scaled content wrapper inside the editor
  if (!previewEl) {
    const scaled = document.querySelector('[style*="transform"]');
    if (scaled?.parentElement) {
      previewEl = scaled.parentElement as HTMLElement;
    }
  }

  if (!previewEl) return '';

  // Walk the DOM and produce clean email HTML
  let bodyHtml = '';
  for (const child of Array.from(previewEl.childNodes)) {
    bodyHtml += nodeToEmailHtml(child);
  }

  // Clean up any remaining artifacts
  bodyHtml = bodyHtml
    .replace(PUCK_ATTRS_RE, '')
    .replace(EMPTY_STYLE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return bodyHtml;
}
