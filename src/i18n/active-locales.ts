import { locales, localeLabels, type Locale } from "./routing";

/**
 * Which shipped locales are actually shown to end users in the public
 * language switcher. Once Supabase is connected (Phase 2+) this reads the
 * `locales` table (`is_active` column, managed from Admin → Languages) so
 * the admin can soft-launch a language without a code deploy — see
 * supabase/migrations/0002_locales.sql and the Admin Panel section of the
 * project plan.
 *
 * Until then it falls back to "every shipped locale is active", since all
 * three (en/si/ta) already have full translation files.
 */
export async function getActiveLocales(): Promise<
  { code: Locale; label: string; native: string }[]
> {
  return locales.map((code) => ({ code, ...localeLabels[code] }));
}
