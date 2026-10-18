import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Platform-wide on/off switches an admin controls from Admin -> Platform
 * switches. Stored in platform_settings (0030) as "true"/"false" under
 * `feature_<key>`. A missing row means ON, so nothing changes for users until
 * an admin deliberately switches something off.
 */
export const PLATFORM_FEATURES = ["signups", "aiPdfImport", "wantedAds", "liveClasses"] as const;
export type PlatformFeature = (typeof PLATFORM_FEATURES)[number];

export function featureSettingKey(feature: PlatformFeature): string {
  return `feature_${feature}`;
}

/**
 * platform_settings is admin-only under RLS, so ordinary users' server
 * actions read it with the service-role client. Read-only, fixed key, and
 * runs only on the server, so it never exposes anything to the caller.
 * Fails open: if the read itself errors, the feature stays available rather
 * than breaking the whole app over a settings lookup.
 */
export async function isFeatureEnabled(feature: PlatformFeature): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from("platform_settings")
      .select("value")
      .eq("key", featureSettingKey(feature))
      .maybeSingle();
    return data?.value !== "false";
  } catch {
    return true;
  }
}

export const FEATURE_DISABLED_MESSAGES: Record<PlatformFeature, string> = {
  signups: "New sign-ups are paused right now. Please try again later.",
  aiPdfImport: "PDF import is turned off by the platform admin right now. You can still add questions manually or paste them in bulk.",
  wantedAds: "Posting new requests is paused by the platform admin right now. Please try again later.",
  liveClasses: "Scheduling live classes is paused by the platform admin right now. Please try again later.",
};
