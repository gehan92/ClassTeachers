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
 */
export async function notify(
  supabase: SupabaseClient<Database>,
  recipientId: string | null | undefined,
  type: string,
  data: Record<string, Json> = {},
  tab?: string,
): Promise<void> {
  if (!recipientId) return;
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
