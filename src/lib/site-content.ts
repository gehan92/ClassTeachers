import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUrl } from "@/lib/supabase/env";
import {
  SITE_CONTENT_CACHE_TAG,
  SITE_CONTENT_SETTING_KEY,
  defaultSiteContent,
  normalizeSiteContent,
  type SitePhotoSlot,
  type SiteContent,
} from "@/lib/site-content-schema";

/**
 * Built-in photos, used until the admin uploads their own in
 * Admin -> Site content. Served through next/image (see next.config.ts), so
 * each visitor gets a correctly sized WebP/AVIF instead of a 1920px JPEG.
 */
export const DEFAULT_SITE_PHOTOS: Record<SitePhotoSlot, string> = {
  hero: "https://images.pexels.com/photos/8423020/pexels-photo-8423020.jpeg?auto=compress&cs=tinysrgb&w=2000",
  whyUs: "https://images.pexels.com/photos/8423012/pexels-photo-8423012.jpeg?auto=compress&cs=tinysrgb&w=1200",
  howItWorks: "https://images.pexels.com/photos/8199167/pexels-photo-8199167.jpeg?auto=compress&cs=tinysrgb&w=1200",
  cta: "https://images.pexels.com/photos/8423005/pexels-photo-8423005.jpeg?auto=compress&cs=tinysrgb&w=2000",
  advertise: "https://images.pexels.com/photos/8423049/pexels-photo-8423049.jpeg?auto=compress&cs=tinysrgb&w=2000",
};

/**
 * The admin's site content. platform_settings is admin-only under RLS, so
 * this reads its one key with the service-role client — nothing else in
 * that table is exposed. Cached, and refreshed the moment the admin saves
 * (revalidateTag in site-content-actions.ts). Falls back to the built-in
 * content if anything goes wrong, so the public site always renders.
 */
export const getSiteContent = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const { data } = await createAdminClient()
        .from("platform_settings")
        .select("value")
        .eq("key", SITE_CONTENT_SETTING_KEY)
        .maybeSingle();
      if (!data?.value) return defaultSiteContent();
      return normalizeSiteContent(JSON.parse(data.value), getSupabaseUrl());
    } catch {
      return defaultSiteContent();
    }
  },
  ["site-content"],
  { revalidate: 600, tags: [SITE_CONTENT_CACHE_TAG] },
);

export function sitePhoto(content: SiteContent, slot: SitePhotoSlot): string {
  return content.photos[slot] ?? DEFAULT_SITE_PHOTOS[slot];
}
