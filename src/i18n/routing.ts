import { defineRouting } from "next-intl/routing";

/**
 * Locales that ship a translation file (messages/{locale}.json).
 * This is the maximal set the app can render — it is NOT the same as which
 * locales are shown to end users. That subset is admin-controlled at
 * runtime via the `locales` table (see supabase/migrations) so a locale can
 * be soft-launched without a code deploy. See src/i18n/active-locales.ts.
 */
export const locales = ["en", "si", "ta"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, { label: string; native: string }> = {
  en: { label: "English", native: "English" },
  si: { label: "Sinhala", native: "සිංහල" },
  ta: { label: "Tamil", native: "தமிழ்" },
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
