/**
 * What the admin can change on the public website (Admin -> Site content):
 * photos, the homepage's main headings and paragraphs in all three
 * languages, contact details, which homepage sections show, and the ad
 * plan prices. Stored as one JSON value in platform_settings
 * (key "site_content"); read by lib/site-content.ts.
 *
 * Shared by the server (reading/saving) and the admin screen (editing), so
 * it has no server-only imports. normalizeSiteContent() is the single
 * gatekeeper: anything that comes from the database or from the admin form
 * passes through it, so a bad or old value can never break a public page.
 */

export const SITE_LOCALES = ["en", "si", "ta"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export type LocalizedText = Record<SiteLocale, string>;

export const SITE_CONTENT_SETTING_KEY = "site_content";
export const SITE_CONTENT_CACHE_TAG = "site-content";

/** Where uploaded site photos live: the public avatars bucket, under their own folder. */
export const SITE_MEDIA_BUCKET = "avatars";
export const SITE_MEDIA_FOLDER = "site-content";

export const SITE_PHOTO_SLOTS = ["hero", "whyUs", "howItWorks", "cta", "advertise"] as const;
export type SitePhotoSlot = (typeof SITE_PHOTO_SLOTS)[number];

/** Editable headings and paragraphs, with the longest text each may hold. */
export const SITE_TEXT_LIMITS = {
  heroTitle: 80,
  heroHighlight: 60,
  heroSubtitle: 220,
  whyUsTitle: 80,
  whyUsBody: 300,
  howTitle: 80,
  howBody: 300,
  ctaTitle: 100,
  ctaBody: 220,
} as const;
export type SiteTextField = keyof typeof SITE_TEXT_LIMITS;
export const SITE_TEXT_FIELDS = Object.keys(SITE_TEXT_LIMITS) as SiteTextField[];

/** The built-in wording (messages/*.json) each editable field replaces. */
export const SITE_TEXT_DEFAULT_KEYS: Record<SiteTextField, string> = {
  heroTitle: "hero.titlePrefix",
  heroHighlight: "hero.titleEmphasis",
  heroSubtitle: "hero.subtitle",
  whyUsTitle: "homeExtra.whyUs.title",
  whyUsBody: "homeExtra.whyUs.description",
  howTitle: "homeExtra.howItWorks.title",
  howBody: "homeExtra.howItWorks.description",
  ctaTitle: "homeExtra.ctaPhoto.title",
  ctaBody: "homeExtra.ctaPhoto.subtitle",
};

export const SITE_SECTIONS = ["stats", "subjects", "featured", "requests", "schools", "roles", "sponsorSlot"] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

export const AD_PLAN_KEYS = ["basic", "featured", "spotlight"] as const;
export type AdPlanKey = (typeof AD_PLAN_KEYS)[number];

export const CONTACT_LIMITS = { whatsapp: 20, phone: 20, email: 120, address: 160, facebook: 200, hours: 80 } as const;
export type ContactField = keyof typeof CONTACT_LIMITS;

export type SiteContent = {
  /** null = use the built-in photo. */
  photos: Record<SitePhotoSlot, string | null>;
  /** "" in a language = use the built-in wording for that language. */
  text: Record<SiteTextField, LocalizedText>;
  contact: Record<ContactField, string>;
  sections: Record<SiteSection, boolean>;
  adPlans: { show: boolean; prices: Record<AdPlanKey, string> };
};

const SECTION_DEFAULTS: Record<SiteSection, boolean> = {
  stats: true,
  subjects: true,
  featured: true,
  requests: true,
  schools: true,
  roles: true,
  // The "advertise here" box shown when no sponsor has booked the homepage
  // slot. Off by default: an empty sales pitch on the homepage looks unfinished.
  sponsorSlot: false,
};

export function emptyLocalized(): LocalizedText {
  return { en: "", si: "", ta: "" };
}

export function defaultSiteContent(): SiteContent {
  return {
    photos: { hero: null, whyUs: null, howItWorks: null, cta: null, advertise: null },
    text: Object.fromEntries(SITE_TEXT_FIELDS.map((f) => [f, emptyLocalized()])) as Record<SiteTextField, LocalizedText>,
    contact: { whatsapp: "", phone: "", email: "", address: "", facebook: "", hours: "" },
    sections: { ...SECTION_DEFAULTS },
    adPlans: { show: true, prices: { basic: "", featured: "", spotlight: "" } },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Plain, single-spaced text with control characters and angle brackets removed. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * A Sri Lankan mobile number as WhatsApp wants it: digits only, with the 94
 * country code ("077 123 4567" -> "94771234567"). Returns "" when it isn't a
 * number WhatsApp could open.
 */
export function normalizeWhatsapp(value: unknown): string {
  if (typeof value !== "string") return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `94${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `94${digits}`;
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : "";
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Only links to real https pages (no javascript:, data:, etc.). */
export function cleanHttpsUrl(value: unknown, max = 200): string {
  const text = cleanText(value, max);
  if (!text) return "";
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * A photo may only point at a file uploaded through Admin -> Site content
 * (this project's own storage folder). Anything else falls back to the
 * built-in photo, so the public site can never be made to load an image
 * from an unknown server.
 */
export function cleanPhotoUrl(value: unknown, supabaseUrl: string): string | null {
  if (typeof value !== "string" || !supabaseUrl) return null;
  const prefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${SITE_MEDIA_FOLDER}/`;
  if (!value.startsWith(prefix)) return null;
  const rest = value.slice(prefix.length);
  return /^[a-zA-Z0-9._-]+\.(webp|jpg|jpeg|png)(\?v=\d+)?$/.test(rest) ? value : null;
}

export function normalizeSiteContent(raw: unknown, supabaseUrl: string): SiteContent {
  const base = defaultSiteContent();
  const input = isRecord(raw) ? raw : {};

  const photos = isRecord(input.photos) ? input.photos : {};
  for (const slot of SITE_PHOTO_SLOTS) base.photos[slot] = cleanPhotoUrl(photos[slot], supabaseUrl);

  const text = isRecord(input.text) ? input.text : {};
  for (const field of SITE_TEXT_FIELDS) {
    const value = isRecord(text[field]) ? text[field] : {};
    for (const locale of SITE_LOCALES) base.text[field][locale] = cleanText(value[locale], SITE_TEXT_LIMITS[field]);
  }

  const contact = isRecord(input.contact) ? input.contact : {};
  base.contact.whatsapp = normalizeWhatsapp(contact.whatsapp);
  base.contact.phone = cleanText(contact.phone, CONTACT_LIMITS.phone).replace(/[^\d+ ()-]/g, "");
  const email = cleanText(contact.email, CONTACT_LIMITS.email).toLowerCase();
  base.contact.email = isValidEmail(email) ? email : "";
  base.contact.address = cleanText(contact.address, CONTACT_LIMITS.address);
  base.contact.facebook = cleanHttpsUrl(contact.facebook, CONTACT_LIMITS.facebook);
  base.contact.hours = cleanText(contact.hours, CONTACT_LIMITS.hours);

  const sections = isRecord(input.sections) ? input.sections : {};
  for (const section of SITE_SECTIONS) {
    if (typeof sections[section] === "boolean") base.sections[section] = sections[section] as boolean;
  }

  const adPlans = isRecord(input.adPlans) ? input.adPlans : {};
  if (typeof adPlans.show === "boolean") base.adPlans.show = adPlans.show;
  const prices = isRecord(adPlans.prices) ? adPlans.prices : {};
  for (const plan of AD_PLAN_KEYS) base.adPlans.prices[plan] = cleanText(prices[plan], 24);

  return base;
}

/** The admin's wording for this language, or "" to use the built-in text. */
export function siteText(content: SiteContent, field: SiteTextField, locale: string): string {
  const value = content.text[field];
  return (SITE_LOCALES as readonly string[]).includes(locale) ? value[locale as SiteLocale] : value.en;
}

/** A wa.me link that opens a chat with the site's WhatsApp number, with an optional first message. */
export function whatsappLink(number: string, message?: string): string | null {
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
