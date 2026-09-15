import { describe, expect, it } from "vitest";
import { countRichTextWords, hasRichText, stripRichText } from "./rich-text";

describe("stripRichText", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripRichText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("decodes common HTML entities", () => {
    expect(stripRichText("Tom &amp; Jerry &lt;3&gt; &quot;fun&quot; &#39;time&#39;&nbsp;here")).toBe(
      'Tom & Jerry <3> "fun" \'time\' here',
    );
  });
});

describe("hasRichText", () => {
  it("is false for null/undefined/empty", () => {
    expect(hasRichText(null)).toBe(false);
    expect(hasRichText(undefined)).toBe(false);
    expect(hasRichText("")).toBe(false);
  });

  it("is false for markup with no visible text (e.g. an empty editor's <p></p>)", () => {
    expect(hasRichText("<p></p>")).toBe(false);
  });

  it("is true when there's real text", () => {
    expect(hasRichText("<p>Hi</p>")).toBe(true);
  });
});

describe("countRichTextWords", () => {
  it("counts words after stripping markup", () => {
    expect(countRichTextWords("<p>One two three</p>")).toBe(3);
  });

  it("is 0 for empty content", () => {
    expect(countRichTextWords("<p></p>")).toBe(0);
  });
});
