import xss from "xss";

export function sanitizeHtmlForPreview(html: string): string {
  const preprocessed = html.replace(/url\(\s*"([^"]*?)"\s*\)/gi, "url('$1')");
  return xss(preprocessed, {
    whiteList: {
      p: ["style", "class", "align"],
      br: [],
      strong: ["style"],
      b: ["style"],
      em: ["style"],
      i: ["style"],
      u: ["style"],
      s: ["style"],
      strike: ["style"],
      h1: ["style", "class", "align"],
      h2: ["style", "class", "align"],
      h3: ["style", "class", "align"],
      h4: ["style", "class", "align"],
      h5: ["style", "class", "align"],
      h6: ["style", "class", "align"],
      a: ["href", "title", "target", "style", "class"],
      img: ["src", "alt", "title", "width", "height", "style", "class"],
      ul: ["style", "class"],
      ol: ["style", "class"],
      li: ["style", "class"],
      div: ["style", "class", "align"],
      span: ["style", "class"],
      blockquote: ["style", "class"],
      pre: ["style", "class"],
      code: ["style", "class"],
      table: ["style", "class", "width", "height", "border", "cellpadding", "cellspacing", "align", "role"],
      thead: ["style", "class"],
      tbody: ["style", "class"],
      tr: ["style", "class"],
      th: ["style", "class", "colspan", "rowspan", "width", "height", "valign", "align"],
      td: ["style", "class", "colspan", "rowspan", "width", "height", "valign", "align"],
      hr: ["style"],
      center: ["style"],
    },
    css: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "noscript", "iframe", "object", "embed"],
    onTagAttr: (tag, name, value) => {
      if (name === "style") {
        const safeValue = value.replace(/url\(\s*"([^"]*?)"\s*\)/gi, "url('$1')");
        return `${name}="${(xss as any).escapeAttrValue(safeValue)}"`;
      }
      if (tag === "img" && name === "src") {
        if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
          return `${name}="${(xss as any).escapeAttrValue(value)}"`;
        }
        return "";
      }
      if (name === "href") {
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue.startsWith("javascript:") || lowerValue.startsWith("vbscript:") || lowerValue.startsWith("data:")) {
          return "";
        }
      }
      if (name.startsWith("on")) {
        return "";
      }
      return undefined;
    },
  });
}
