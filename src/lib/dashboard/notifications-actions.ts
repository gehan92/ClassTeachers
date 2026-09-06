"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    return { error: "Couldn't update this notification." };
  }
  return {};
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) {
    return { error: "Couldn't update your notifications." };
  }
  return {};
}

/** Clears one notification outright — distinct from marking it read, which
 * just changes how it's styled but leaves it in the list. */
export async function dismissNotification(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("recipient_id", user.id);
  if (error) {
    return { error: "Couldn't clear this notification." };
  }
  return {};
}

export async function clearAllNotifications(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("notifications").delete().eq("recipient_id", user.id);
  if (error) {
    return { error: "Couldn't clear your notifications." };
  }
  return {};
}
