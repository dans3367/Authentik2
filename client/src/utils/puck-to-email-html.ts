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
 * Extract text-align value from an element's explicit inline style attribute only.
 * Returns 'left', 'center', or 'right' if found, null otherwise.
 * This avoids using getComputedStyle which returns the default 'start' for every element.
 */
function getExplicitTextAlign(el: HTMLElement): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const match = style.match(/text-align\s*:\s*(left|center|right|start|end)/i);
  if (!match) return null;
  const val = match[1].toLowerCase();
  if (val === 'start') return 'left';
  if (val === 'end') return 'right';
  return val;
}

/**
 * Convert a Flex container div (with inline flex styles) into table-based HTML for email.
 * Reads justify-content, flex-direction, and gap from the inline style and produces
 * a table with proper align attributes that email clients support.
 */
function convertFlexToTable(el: HTMLElement, styleStr: string): string {
  // Parse flex properties from inline style
  const justifyMatch = styleStr.match(/justify-content\s*:\s*([\w-]+)/i);
  const directionMatch = styleStr.match(/flex-direction\s*:\s*([\w-]+)/i);
  const gapMatch = styleStr.match(/gap\s*:\s*(\d+(?:\.\d+)?)\s*(px|rem|em|%|[a-z]*)/i);

  const justify = justifyMatch ? justifyMatch[1].toLowerCase() : 'start';
  const direction = directionMatch ? directionMatch[1].toLowerCase() : 'row';
  // Parse gap value — assume px for unitless or px; skip non-px units (treat as 0 for now)
  let gap = 0;
  if (gapMatch) {
    const value = parseFloat(gapMatch[1]);
    const unit = (gapMatch[2] || '').toLowerCase();
    if (unit === '' || unit === 'px') {
      gap = value;
    }
    // Non-px units (rem, em, %) are not reliably convertible — default to 0
  }

  // Map justify-content to HTML align attribute
  const alignMap: Record<string, string> = {
    start: 'left',
    'flex-start': 'left',
    center: 'center',
    end: 'right',
    'flex-end': 'right',
    'space-between': 'center',
    'space-around': 'center',
    'space-evenly': 'center',
  };
  const align = alignMap[justify] || 'left';

  // Collect child elements (skip text-only whitespace nodes)
  const children: HTMLElement[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      children.push(child as HTMLElement);
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      // Wrap text nodes in a span to preserve them
      const wrapper = document.createElement('span');
      wrapper.textContent = child.textContent;
      children.push(wrapper);
    }
  }

  if (children.length === 0) return '';

  // Convert each child to email HTML
  const childHtmls = children.map(child => nodeToEmailHtml(child));

  if (direction === 'column') {
    // Column layout: stack items vertically in separate rows
    const rows = childHtmls
      .filter(h => h.trim())
      .map((html, i) => {
        const paddingTop = i > 0 && gap > 0 ? ` style="padding-top: ${gap}px;"` : '';
        return `<tr><td align="${align}"${paddingTop}>${html}</td></tr>`;
      })
      .join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;"><tbody>${rows}</tbody></table>`;
  }

  // Row layout: place items side-by-side in table cells
  const cells: string[] = [];
  const nonEmptyHtmls = childHtmls.filter(h => h.trim());

  for (let i = 0; i < nonEmptyHtmls.length; i++) {
    if (i > 0 && gap > 0) {
      // Spacer cell for gap
      cells.push(`<td style="width: ${gap}px; font-size: 0; line-height: 0;">&nbsp;</td>`);
    }
    cells.push(`<td align="${align}" valign="top" style="vertical-align: top;">${nonEmptyHtmls[i]}</td>`);
  }

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="${align}" style="border-collapse: collapse;"><tbody><tr>${cells.join('')}</tr></tbody></table>`;
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

  // The element's explicit inline style attribute (set via React style prop)
  const existingStyle = el.getAttribute('style');

  // ── Space / Spacer → table-based spacer for email ──
  // Detected via data-email-spacer attribute (set by the Space Puck component).
  // Email clients collapse divs with height styles, so we emit a table-based spacer.
  const spacerDir = el.getAttribute('data-email-spacer');
  if (spacerDir) {
    console.log('[puck-to-email-html] Spacer detected:', spacerDir, 'size:', el.getAttribute('data-email-spacer-size'));
    const size = parseInt(el.getAttribute('data-email-spacer-size') || '24', 10);
    const isHz = spacerDir === 'horizontal';
    const w = isHz ? `${size}` : '100%';
    const hAttr = isHz ? '' : ` height="${size}"`;
    const wAttr = isHz ? ` width="${size}"` : '';
    const hStyle = isHz ? '' : `height: ${size}px; `;
    const wStyle = isHz ? `width: ${size}px; ` : '';
    return `<table width="${w}" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;"><tbody><tr><td${hAttr}${wAttr} style="${hStyle}${wStyle}line-height: ${size}px; font-size: 1px; mso-line-height-rule: exactly;">&nbsp;</td></tr></tbody></table>`;
  }

  // ── Flex container → table conversion for email ──
  // Puck's Flex component applies inline flex styles (justify-content, flex-direction,
  // gap, flex-wrap) on its Items slot div. Email clients don't support flexbox, so we
  // convert this into a table-based layout before the generic div-unwrapping logic runs.
  if (tag === 'div' && existingStyle && /justify-content/i.test(existingStyle)) {
    return convertFlexToTable(el, existingStyle);
  }

  // Build children HTML first — needed for potential unwrapping
  let childrenHtml = '';
  for (const child of Array.from(el.childNodes)) {
    childrenHtml += nodeToEmailHtml(child);
  }

  // Unwrap ALL divs unless they carry visually meaningful styles.
  // Puck's editor wraps each component in divs with inline styles like display:flex,
  // the Layout HOC adds padding divs, and Section adds max-width divs.
  // Keep a div if it has background-color, background-image, text-align, border,
  // or non-zero padding (Section horizontal padding, Layout vertical padding).
  if (tag === 'div') {
    if (!existingStyle) return childrenHtml;
    // Only keep divs with visually meaningful styles
    const hasBackground = /background-color\s*:\s*(?!transparent|rgba\(0,\s*0,\s*0,\s*0\))/i.test(existingStyle);
    const hasBgImage = /background-image\s*:\s*(?!none)/i.test(existingStyle);
    const hasTextAlign = /text-align/i.test(existingStyle);
    const hasVisibleBorder = /border[^:]*:\s*[1-9]/i.test(existingStyle);
    const hasPadding = /padding[^:]*:[^;]*[1-9]/i.test(existingStyle);
    const hasHeight = /(?:^|;)\s*height\s*:[^;]*[1-9]/i.test(existingStyle);
    const hasWidth = /(?:^|;)\s*width\s*:[^;]*[1-9]/i.test(existingStyle);
    if (!hasBackground && !hasBgImage && !hasTextAlign && !hasVisibleBorder && !hasPadding && !hasHeight && !hasWidth) return childrenHtml;
  }

  // Only use the explicit inline style attribute for styling — do NOT dump
  // computed styles from CSS classes onto every element. Computed styles cause
  // massive bloat (border:0px, box-sizing, etc.) and can override child alignment.
  const inlineStyles: string[] = [];

  if (existingStyle) {
    const resolved = resolveCssVars(existingStyle);
    const parsed = resolved.split(';').filter(Boolean).map(s => s.trim());
    for (const rule of parsed) {
      const colonIdx = rule.indexOf(':');
      if (colonIdx > 0) {
        // Strip CSS properties that email clients don't support
        const prop = rule.substring(0, colonIdx).trim().toLowerCase();
        const val = rule.substring(colonIdx + 1).trim().toLowerCase();
        if (prop === 'display' && /^(flex|inline-flex|grid|inline-grid)$/i.test(val)) continue;
        if (/^(flex-direction|flex-wrap|flex-grow|flex-shrink|flex-basis|justify-content|align-items|align-self|gap|order)$/.test(prop)) continue;
        inlineStyles.push(rule);
      }
    }
  }

  // Map semantic tags for email
  const emailTag = mapTagForEmail(tag);

  // Replace double quotes with single quotes in style values to prevent
  // breaking the HTML style="..." attribute (e.g. font-family computed values
  // contain "system-ui" which prematurely closes the attribute).
  const joinedStyles = inlineStyles.join('; ').replace(/"/g, "'");
  const styleAttr = joinedStyles.length > 0 ? ` style="${joinedStyles}"` : '';

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
  if (alt !== null) extraAttrs += ` alt="${alt}"`;

  // Table-specific attributes — critical for email clients (especially Outlook)
  if (['table', 'td', 'th', 'tr', 'col', 'colgroup', 'tbody', 'thead', 'tfoot'].includes(tag)) {
    const tableAttrs = ['cellpadding', 'cellspacing', 'border', 'role', 'width', 'height', 'align', 'valign', 'bgcolor', 'background', 'colspan', 'rowspan'];
    for (const attr of tableAttrs) {
      const val = el.getAttribute(attr);
      if (val !== null) extraAttrs += ` ${attr}="${val}"`;
    }
    // Synthesize align on td/th from explicit inline text-align if no align attr exists
    if ((tag === 'td' || tag === 'th') && !el.getAttribute('align')) {
      const explicitTA = getExplicitTextAlign(el);
      if (explicitTA) extraAttrs += ` align="${explicitTA}"`;
    }
    // Synthesize background attribute from CSS background-image for email clients
    // that don't support CSS background-image (notably Outlook)
    if ((tag === 'td' || tag === 'th') && !el.getAttribute('background') && existingStyle) {
      const bgImgMatch = existingStyle.match(/background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i);
      if (bgImgMatch && bgImgMatch[1]) {
        const bgUrl = bgImgMatch[1].trim();
        if (bgUrl.startsWith('http://') || bgUrl.startsWith('https://')) {
          extraAttrs += ` background="${bgUrl}"`;
        }
      }
    }
  }

  // Preserve or synthesize align attribute on block-level elements (h1-h6, p, div).
  // Email clients reliably support this legacy HTML attribute even when CSS text-align
  // is stripped. If the element doesn't have an explicit align attribute, derive it
  // from the collected text-align inline style value.
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(tag)) {
    let alignVal = el.getAttribute('align');
    if (!alignVal) {
      // Synthesize from explicit inline text-align (not computed default)
      alignVal = getExplicitTextAlign(el);
    }
    if (alignVal) extraAttrs += ` align="${alignVal}"`;
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
  const safe = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'img', 'br', 'hr', 'span', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'colgroup', 'col', 'blockquote'];
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
    // Try to find the scaled preview wrapper - narrow scope to likely editor containers
    const scaled = document.querySelector('[data-puck-editor] [style*="transform"], .puck-editor [style*="transform"]');
    if (scaled?.parentElement) {
      previewEl = scaled.parentElement as HTMLElement;
      console.warn('extractPuckEmailHtml: using transform fallback selector');
    }
  }

  if (!previewEl) {
    console.warn('[puck-to-email-html] No Puck preview element found. Tried selectors:', selectors);
    return '';
  }

  // Walk the DOM and produce clean email HTML
  let bodyHtml = '';
  for (const child of Array.from(previewEl.childNodes)) {
    bodyHtml += nodeToEmailHtml(child);
  }

  // Clean up any remaining artifacts
  bodyHtml = bodyHtml
    .replace(EMPTY_STYLE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return bodyHtml;
}
