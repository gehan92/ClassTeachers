import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Server-side counterpart of trackEvent() in ./track.ts — called from server
 * actions after a feature was actually used (an exam created, a roll call
 * taken...), so Admin -> Traffic can show which features people really use.
 * The database fills in the role from the caller's session. Never throws:
 * a tracking failure must not fail the action that was just completed.
 */
export async function recordFeatureEvent(event: string, metadata: Record<string, Json> = {}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("track_feature_event", { p_event: event, p_metadata: metadata });
  } catch {
    // Tracking is best-effort.
  }
}
