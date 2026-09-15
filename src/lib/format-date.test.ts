import { describe, expect, it } from "vitest";
import { createDateFormatter, createDateTimeFormatter, createScheduleFormatter } from "./format-date";

// Fixed instant: 2026-01-15 23:30 UTC == 2026-01-16 05:00 Asia/Colombo
// (UTC+5:30) — chosen specifically to cross midnight, so a formatter that
// forgot the explicit Asia/Colombo timeZone (defaulting to the server's UTC
// clock, per this file's own comment on why that matters) would show the
// wrong day, not just the wrong hour.
const INSTANT = new Date("2026-01-15T23:30:00.000Z");

describe("createDateFormatter", () => {
  it("renders in Asia/Colombo, not UTC", () => {
    const formatted = createDateFormatter("en").format(INSTANT);
    expect(formatted).toContain("Jan 16, 2026");
  });
});

describe("createScheduleFormatter", () => {
  it("renders weekday + time in Asia/Colombo", () => {
    const formatted = createScheduleFormatter("en").format(INSTANT);
    expect(formatted).toContain("Fri");
    expect(formatted).toContain("5:00");
  });
});

describe("createDateTimeFormatter", () => {
  it("renders date and time together in Asia/Colombo", () => {
    const formatted = createDateTimeFormatter("en").format(INSTANT);
    expect(formatted).toContain("Jan 16, 2026");
    expect(formatted).toContain("5:00");
  });
});
