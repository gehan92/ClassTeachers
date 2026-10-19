import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

/**
 * Browser-side usage tracking for Admin -> Traffic (0165). Privacy rules:
 * no IP, no name, no email — only the page, language, device type, where
 * the visitor came from, and an anonymous random visitor id kept in this
 * browser's localStorage. The role is looked up by the database itself from
 * the session, never sent from here.
 *
 * Every call is fire-and-forget and swallows its own errors: tracking must
 * never slow down or break a page.
 */

const VISITOR_KEY = "cp_visitor_id";
const LOCALES = ["en", "si", "ta"];
const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp/i;

function isTrackable(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.webdriver) return false;
  if (BOT_PATTERN.test(navigator.userAgent)) return false;
  return true;
}

function visitorId(): string | null {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function deviceType(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  if (/iPad|Tablet/i.test(navigator.userAgent) || (width >= 640 && width < 1024 && "ontouchstart" in window)) {
    return "tablet";
  }
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent) || width < 640) return "mobile";
  return "desktop";
}

/** Only the host, and only when it's another site — internal navigation isn't a "source". */
function referrerHost(): string | null {
  if (!document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host === window.location.hostname.replace(/^www\./, "") ? null : host;
  } catch {
    return null;
  }
}

/** "/si/teacher/123" -> { locale: "si", path: "/teacher/123" }. */
function splitLocale(pathname: string): { locale: string | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && LOCALES.includes(first)) return { locale: first, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  return { locale: null, path: pathname || "/" };
}

let lastTracked = "";

export function trackPageVisit(pathname: string, search: string) {
  if (!isTrackable()) return;
  const { locale, path } = splitLocale(pathname);
  const params = new URLSearchParams(search);
  // Dashboards keep their open tab in ?tab=, so each tab counts as its own page.
  const tab = params.get("tab");
  const fullPath = tab ? `${path}?tab=${tab}` : path;
  if (fullPath === lastTracked) return;
  lastTracked = fullPath;
  const searchTerm = [params.get("subject"), params.get("location")].filter(Boolean).join(" · ") || null;
  void createClient()
    .rpc("track_page_visit", {
      p_path: fullPath,
      p_locale: locale,
      p_device: deviceType(),
      p_referrer_host: referrerHost(),
      p_search_query: searchTerm,
      p_visitor_id: visitorId(),
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** A named action, e.g. trackEvent("search_performed", { subject: "Maths", results: 4 }). */
export function trackEvent(event: string, metadata: Record<string, Json> = {}) {
  if (!isTrackable()) return;
  void createClient()
    .rpc("track_feature_event", { p_event: event, p_metadata: metadata })
    .then(
      () => undefined,
      () => undefined,
    );
}
