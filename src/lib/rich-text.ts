// Shared helpers for HTML produced by RichTextEditor (components/ui/rich-text-editor.tsx).
// Word-count/emptiness checks here are UX guardrails, not exact — good enough
// for a soft word limit, not meant to be a precise DOM-aware parser.

export function stripRichText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasRichText(html: string | null | undefined): boolean {
  return Boolean(html && stripRichText(html));
}

export function countRichTextWords(html: string): number {
  const text = stripRichText(html);
  return text ? text.split(/\s+/).length : 0;
}

// Tailwind utility classes for rendering sanitized RichTextEditor HTML wherever
// it's displayed (dashboard cards, preview cards, public board/detail pages) —
// kept in one place so every render site stays visually consistent.
export const RICH_TEXT_DISPLAY_CLASS =
  "[&_p]:my-0 [&_ul]:my-0 [&_ul]:list-disc [&_ul]:pl-4.5 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pl-4.5 [&_strong]:font-semibold";
