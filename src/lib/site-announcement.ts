import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SiteAnnouncement } from "@/components/layout/site-announcement-bar";

export const ANNOUNCEMENT_KEYS = ["announcement_enabled", "announcement_text", "announcement_tone"] as const;
export const ANNOUNCEMENT_CACHE_TAG = "site-announcement";
export const ANNOUNCEMENT_MAX_LENGTH = 240;

/**
 * The admin's site-wide announcement (Admin -> Settings), stored in
 * platform_settings. platform_settings is admin-only under RLS, so this
 * reads three fixed keys with the service-role client — nothing else is
 * exposed. Cached and refreshed instantly when the admin saves
 * (revalidateTag in updateAnnouncement), so pages don't hit the database
 * for it on every request. Fails closed to "no banner".
 */
export const getSiteAnnouncement = unstable_cache(
  async (): Promise<SiteAnnouncement | null> => {
    try {
      const { data } = await createAdminClient()
        .from("platform_settings")
        .select("key, value")
        .in("key", [...ANNOUNCEMENT_KEYS]);
      const value = (key: string) => data?.find((row) => row.key === key)?.value ?? "";
      const text = value("announcement_text").trim();
      if (value("announcement_enabled") !== "true" || !text) return null;
      const tone = value("announcement_tone");
      return {
        text: text.slice(0, ANNOUNCEMENT_MAX_LENGTH),
        tone: tone === "warning" || tone === "success" ? tone : "info",
      };
    } catch {
      return null;
    }
  },
  ["site-announcement"],
  { revalidate: 300, tags: [ANNOUNCEMENT_CACHE_TAG] },
);
