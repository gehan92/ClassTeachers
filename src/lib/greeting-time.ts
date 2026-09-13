export type GreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Client-local time of day, used to pick a "Good morning/afternoon/evening"
 * greeting on the Teacher/Student dashboard Home pages. Must only be called
 * from a useEffect (not during render) — the server has no idea what the
 * viewer's local hour is, so computing this during the initial render would
 * mismatch between SSR and the client and trip a hydration warning.
 */
export function getGreetingPeriod(): GreetingPeriod {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
