import "server-only";
import sanitizeHtml from "sanitize-html";

// Single allowlist shared by every write path (wanted-ads-actions.ts) and
// every read path that renders this HTML with dangerouslySetInnerHTML
// (dashboard cards, the public requests board, the request detail page).
// Sanitizing again on read — not just on write — means rows saved before
// this allowlist existed (plain text, never escaped) can't smuggle in a tag
// the moment they're rendered as HTML instead of a React text node.
const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "ul", "ol", "li"],
  allowedAttributes: { p: ["style"], li: ["style"] },
  allowedStyles: { "*": { "text-align": [/^left$/, /^center$/, /^right$/] } },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_SANITIZE_OPTIONS).trim();
}

export function sanitizeRichTextNullable(html: string | null | undefined): string | null {
  if (!html) return null;
  const clean = sanitizeRichText(html);
  return clean || null;
}
