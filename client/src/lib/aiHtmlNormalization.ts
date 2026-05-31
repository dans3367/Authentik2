const AI_BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,table";
const INVISIBLE_TEXT_PATTERN = /[\s\u00a0\u200b\u200c\u200d\ufeff]+/g;

function hasSignificantContent(node: ChildNode): boolean {
  return node.nodeType === Node.ELEMENT_NODE || (node.textContent?.trim().length ?? 0) > 0;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasMeaningfulNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean((node.textContent || "").replace(INVISIBLE_TEXT_PATTERN, ""));
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "br") return false;
  if (["img", "hr", "table", "ul", "ol"].includes(tagName)) return true;

  return Array.from(element.childNodes).some(hasMeaningfulNode);
}

function trimSpacerEdges(element: Element) {
  const isSpacerNode = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return !(node.textContent || "").replace(INVISIBLE_TEXT_PATTERN, "");
    }
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "br";
  };

  while (element.firstChild && isSpacerNode(element.firstChild)) {
    element.firstChild.remove();
  }

  while (element.lastChild && isSpacerNode(element.lastChild)) {
    element.lastChild.remove();
  }
}

function removeEmptyTextBlocks(html: string): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll("p,h1,h2,h3,h4,h5,h6,blockquote").forEach((element) => {
    trimSpacerEdges(element);
    if (!hasMeaningfulNode(element)) {
      element.remove();
    }
  });

  return template.innerHTML.trim();
}

// AI models separate block elements with newlines ("</p>\n\n<p>"). editor.setContent()
// drops that inter-block whitespace, but insertContent() (used by the selection AI tools)
// re-parses each whitespace run into a spurious "<p> </p>" block that renders as a blank-line
// gap after every paragraph. Strip whitespace sitting on block-tag boundaries so every insert
// path receives tight "</p><p>" markup. Whitespace inside text content and inside <pre> code
// blocks is left untouched.
const BLOCK_CLOSE_TAGS = "p|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tfoot|tr|td|th|figure|figcaption|pre|div|section|article";
const BLOCK_CONTAINER_OPEN_TAGS = "ul|ol|table|thead|tbody|tfoot|tr|blockquote|figure|div|section|article";

function collapseInterBlockWhitespace(html: string): string {
  return html
    // whitespace after a block-level close tag: "</p>\n\n<p>" -> "</p><p>", "</li>\n<li>" -> "</li><li>"
    .replace(new RegExp(`(</(?:${BLOCK_CLOSE_TAGS})>)\\s+`, "gi"), "$1")
    // whitespace right after a block container's open tag: "<ul>\n  <li>" -> "<ul><li>"
    .replace(new RegExp(`(<(?:${BLOCK_CONTAINER_OPEN_TAGS})\\b[^>]*>)\\s+`, "gi"), "$1")
    .trim();
}

// AI models often return paragraphs separated by stray <br> tags or empty
// <p></p> blocks. TipTap renders those as large blank spaces, so normalize
// them into clean paragraph blocks before inserting, loading, or saving.
export function normalizeAiHtml(html: string | undefined | null): string {
  if (!html) return "";
  let out = html.trim();

  out = out
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!/<[a-z][\s\S]*>/i.test(out)) {
    return out
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${escapeHtml(part).replace(/\n+/g, " ")}</p>`)
      .join("");
  }

  out = out.replace(/(<(?:p|h[1-6]|li|blockquote)\b[^>]*>)(?:\s*<br\b[^>]*>)+\s*/gi, "$1");
  out = out.replace(/(?:\s*<br\b[^>]*>)+\s*(<\/(?:p|h[1-6]|li|blockquote)>)/gi, "$1");
  out = out.replace(/(<\/(?:p|h[1-6]|ul|ol|li|blockquote|table)>)(?:\s*<br\b[^>]*>)+\s*(<(?:p|h[1-6]|ul|ol|li|blockquote|table)\b[^>]*>)/gi, "$1$2");
  out = out.replace(/(<\/(?:p|h[1-6]|ul|ol|li|blockquote|table)>)(?:\s*<br\b[^>]*>)+\s*/gi, "$1");
  out = out.replace(/(?:\s*<br\b[^>]*>)+\s*(<(?:p|h[1-6]|ul|ol|li|blockquote|table)\b[^>]*>)/gi, "$1");
  out = out.replace(/(?:\s*<br\b[^>]*>\s*){2,}/gi, "</p><p>");
  out = out.replace(/<p[^>]*>\s*(?:<br\b[^>]*>\s*|&nbsp;|\u00a0|\s)*<\/p>/gi, "");

  return collapseInterBlockWhitespace(removeEmptyTextBlocks(out.trim()));
}

function getAiHtmlFragment(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

export function hasTopLevelAiBlocks(html: string): boolean {
  const fragment = getAiHtmlFragment(html);
  return Boolean(fragment.querySelector(AI_BLOCK_SELECTOR));
}

export function aiHtmlToInlineHtml(html: string): string {
  const fragment = getAiHtmlFragment(html);
  const pieces: string[] = [];

  const addPiece = (value: string | null | undefined) => {
    const trimmed = (value || "").trim();
    if (trimmed) pieces.push(trimmed);
  };

  Array.from(fragment.childNodes)
    .filter(hasSignificantContent)
    .forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        addPiece(escapeHtml(node.textContent || ""));
        return;
      }

      const element = node as Element;
      if (element.matches("p,h1,h2,h3,h4,h5,h6,blockquote")) {
        addPiece(element.innerHTML);
        return;
      }

      if (element.matches("ul,ol")) {
        element.querySelectorAll("li").forEach((li) => addPiece(li.innerHTML || li.textContent));
        return;
      }

      if (element.querySelector(AI_BLOCK_SELECTOR)) {
        element.querySelectorAll("p,h1,h2,h3,h4,h5,h6,blockquote,li").forEach((child) => {
          addPiece(child.innerHTML || child.textContent);
        });
        return;
      }

      addPiece(element.outerHTML);
    });

  return pieces.join("<br>");
}

function addInlineTextToBlock(element: Element, text: string, position: "start" | "end") {
  const trimmed = text.trim();
  if (!trimmed) return;

  const escaped = escapeHtml(trimmed);

  if (element.matches("p,h1,h2,h3,h4,h5,h6,blockquote")) {
    const current = element.innerHTML.trim();
    element.innerHTML = position === "start"
      ? `${escaped}${current ? " " : ""}${element.innerHTML}`
      : `${element.innerHTML}${current ? " " : ""}${escaped}`;
    return;
  }

  const paragraph = document.createElement("p");
  paragraph.innerHTML = escaped;
  if (position === "start") {
    element.before(paragraph);
  } else {
    element.after(paragraph);
  }
}

export function mergeAiBlocksWithSurroundingText(html: string, beforeText: string, afterText: string): string {
  const wrapper = document.createElement("div");
  wrapper.append(getAiHtmlFragment(html));

  let blocks = Array.from(wrapper.children).filter((element) => element.matches(AI_BLOCK_SELECTOR));
  if (blocks.length === 0) {
    blocks = Array.from(wrapper.querySelectorAll(AI_BLOCK_SELECTOR));
  }

  if (blocks.length === 0) {
    return aiHtmlToInlineHtml(html);
  }

  addInlineTextToBlock(blocks[0], beforeText, "start");
  addInlineTextToBlock(blocks[blocks.length - 1], afterText, "end");

  return wrapper.innerHTML.trim();
}
