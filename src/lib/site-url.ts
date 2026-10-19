import { routing } from "@/i18n/routing";

/**
 * The public address of the site, for canonical links, the sitemap and
 * link previews. NEXT_PUBLIC_SITE_URL wins (set it once a custom domain is
 * live); otherwise Vercel's production domain; otherwise the current one.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "https://class-teachers.vercel.app";
}

/**
 * canonical + hreflang links for one page, given its path without the
 * locale ("" for the homepage, "/teachers", "/ad/123"...).
 */
export function localeAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}
