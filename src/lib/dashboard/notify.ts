import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Thin wrapper around the create_notification RPC (0105), called from
 * inside other server actions right after their own write already
 * succeeded — never a Server Action itself (no "use server" here), just a
 * plain helper, since it always runs server-to-server with a client its
 * caller already has, never invoked directly from a client component.
 *
 * Never throws or blocks the action it's called from: a notification
 * failing to write shouldn't take down the actual thing that happened (an
 * accept, a grade, a reply), so every caller fires this and ignores the
 * result.
 *
 * `prefKey`, when passed, gates the notification on the recipient's own
 * notification_prefs (profiles.notification_prefs, toggled from each
 * dashboard's Settings tab) — every notify() call used to fire
 * unconditionally regardless of what the toggles said, which made the
 * Settings UI decorative. Missing/undefined for a key still means "on"
 * (opt-out, not opt-in), matching how the Settings toggles already default
 * to checked. Omit prefKey entirely for notifications nobody should be able
 * to turn off (none currently — every notify() call site passes one).
 */
export async function notify(
  supabase: SupabaseClient<Database>,
  recipientId: string | null | undefined,
  type: string,
  data: Record<string, Json> = {},
  tab?: string,
  prefKey?: string,
): Promise<void> {
  if (!recipientId) return;
  if (prefKey) {
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", recipientId)
      .maybeSingle();
    const prefs = (recipientProfile?.notification_prefs as Record<string, boolean> | null) ?? {};
    if (prefs[prefKey] === false) return;
  }
  await supabase.rpc("create_notification", {
    p_recipient_id: recipientId,
    p_type: type,
    p_data: data,
    p_tab: tab ?? null,
  });
}

export async function notifyAdmins(
  supabase: SupabaseClient<Database>,
  type: string,
  data: Record<string, Json> = {},
  tab?: string,
): Promise<void> {
  await supabase.rpc("create_admin_notification", { p_type: type, p_data: data, p_tab: tab ?? null });
}
