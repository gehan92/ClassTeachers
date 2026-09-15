import { describe, expect, it } from "vitest";
import { sanitizeRichText, sanitizeRichTextNullable } from "./sanitize-rich-text";

describe("sanitizeRichText", () => {
  it("keeps the allowlisted formatting tags", () => {
    const input = "<p>Hello <strong>world</strong>, <em>welcome</em> to <u>class</u>.</p>";
    expect(sanitizeRichText(input)).toBe(input);
  });

  it("keeps lists", () => {
    const input = "<ul><li>One</li><li>Two</li></ul>";
    expect(sanitizeRichText(input)).toBe(input);
  });

  it("strips a <script> tag entirely — the XSS case this exists to stop", () => {
    const input = '<p>Hi</p><script>alert("xss")</script>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
  });

  it("strips an inline event-handler attribute", () => {
    const input = '<p onmouseover="alert(1)">Hover me</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain("onmouseover");
  });

  it("strips a javascript: href since <a> isn't on the allowlist at all", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain("<a");
    expect(result).not.toContain("javascript:");
  });

  it("only allows the specific text-align style values", () => {
    const allowed = '<p style="text-align:center">Centered</p>';
    expect(sanitizeRichText(allowed)).toContain("text-align:center");

    const disallowed = '<p style="text-align:center; position:fixed; top:0">Bad</p>';
    const result = sanitizeRichText(disallowed);
    expect(result).not.toContain("position");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeRichText("  <p>Hi</p>  ")).toBe("<p>Hi</p>");
  });
});

describe("sanitizeRichTextNullable", () => {
  it("returns null for null/undefined input", () => {
    expect(sanitizeRichTextNullable(null)).toBeNull();
    expect(sanitizeRichTextNullable(undefined)).toBeNull();
  });

  it("returns null when sanitizing leaves nothing behind", () => {
    expect(sanitizeRichTextNullable("<script>alert(1)</script>")).toBeNull();
  });

  it("returns the sanitized string when there's real content", () => {
    expect(sanitizeRichTextNullable("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});
