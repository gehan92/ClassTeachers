// Every date/time show to a viewer is formatted on the server (these run
// inside async Server Components, not the browser) — Vercel's runtime
// clock is UTC, so without an explicit timeZone every formatted date/time
// silently comes out in UTC instead of the viewer's real local time.
// ClassPortals only serves Sri Lanka, so rather than plumbing a per-user
// timezone through the whole app, every server-side formatter hard-codes
// Asia/Colombo (UTC+5:30) — which also matches what a Sri Lankan teacher's
// own browser means when they type into a plain datetime-local input.
const TIME_ZONE = "Asia/Colombo";

/** "Aug 24, 2026" — for day-only events (graded date, submitted date, created date). */
export function createDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: TIME_ZONE });
}

/** "Mon, 9:48 PM" — for anything with a specific clock time (live class/exam schedule). */
export function createScheduleFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}
