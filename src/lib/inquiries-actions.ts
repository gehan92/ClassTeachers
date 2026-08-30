"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const submitInquirySchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  ownerId: z.string().uuid(),
  name: z.string().trim().min(2),
  contact: z.string().trim().min(5),
  message: z.string().trim().min(10),
});

/**
 * The one anon-writable action in this codebase — a visitor doesn't need an
 * account to send an inquiry (confirmed with Gehan). Routed through the
 * submit_inquiry RPC (0037) rather than a plain insert so the duplicate-spam
 * guard can live server-side without needing its own SELECT access (RLS
 * only lets the owner/admin read inquiries, not the sender).
 */
export async function submitInquiry(input: {
  ownerType: "teacher" | "class";
  ownerId: string;
  name: string;
  contact: string;
  message: string;
}): Promise<ActionResult> {
  const parsed = submitInquirySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in your name, a way to reach you, and a message." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_inquiry", {
    p_owner_type: parsed.data.ownerType,
    p_owner_id: parsed.data.ownerId,
    p_sender_name: parsed.data.name,
    p_sender_contact: parsed.data.contact,
    p_message: parsed.data.message,
  });
  if (error) {
    if (error.message.includes("duplicate_inquiry")) {
      return { error: "You already sent a message recently. Please wait a bit before sending another." };
    }
    return { error: "Couldn't send your message. Please try again." };
  }
  return {};
}

export async function markInquiryRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("inquiries").update({ status: "read" }).eq("id", id);
  if (error) {
    return { error: "Couldn't update this message. Please try again." };
  }
  return {};
}

const messageSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1),
});

/**
 * The owner's (teacher/institute) side of a real thread (0088) — was a
 * single reply column, now one message among many. Still just closes the
 * loop for a guest sender with no account (inquirer_id null): they have no
 * way to ever see this, same limitation as before 0088, just now living in
 * a table instead of a column.
 */
export async function replyToInquiry(id: string, body: string): Promise<ActionResult> {
  const parsed = messageSchema.safeParse({ id, body });
  if (!parsed.success) {
    return { error: "Please write a message first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error: insertError } = await supabase
    .from("inquiry_messages")
    .insert({ inquiry_id: parsed.data.id, sender_role: "owner", body: parsed.data.body });
  if (insertError) {
    return { error: "Couldn't send your reply. Please try again." };
  }
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .update({ status: "read" })
    .eq("id", parsed.data.id)
    .select("inquirer_id")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't send your reply. Please try again." };
  }
  // Only reachable when the sender was signed in at inquiry time (0037) — a
  // guest inquirer has no account to notify.
  await notify(supabase, inquiry?.inquirer_id, "inquiry_reply", {}, "inquiries");
  return {};
}

/**
 * The inquirer's (student) side of the same thread — only reachable when
 * they were signed in at the moment they submitted the inquiry (0037's
 * submit_inquiry stashes auth.uid() as inquirer_id); RLS on inquiry_messages
 * enforces that sender_role: 'inquirer' can only be inserted by that exact
 * account.
 */
export async function sendInquirerMessage(id: string, body: string): Promise<ActionResult> {
  const parsed = messageSchema.safeParse({ id, body });
  if (!parsed.success) {
    return { error: "Please write a message first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error: insertError } = await supabase
    .from("inquiry_messages")
    .insert({ inquiry_id: parsed.data.id, sender_role: "inquirer", body: parsed.data.body });
  if (insertError) {
    return { error: "Couldn't send your message. Please try again." };
  }
  // Flips the owner's badge/bell back on — otherwise it stays "read" forever
  // after their first reply and they'd never notice a follow-up arrived.
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .update({ status: "new" })
    .eq("id", parsed.data.id)
    .select("owner_type, owner_id")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't send your message. Please try again." };
  }
  if (inquiry) {
    let recipientId = inquiry.owner_id;
    if (inquiry.owner_type === "class") {
      const { data: cp } = await supabase.from("class_profiles").select("owner_id").eq("id", inquiry.owner_id).maybeSingle();
      recipientId = cp?.owner_id ?? inquiry.owner_id;
    }
    await notify(supabase, recipientId, "inquiry_message", {}, "inquiries");
  }
  return {};
}

export async function deleteInquiry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) {
    return { error: "Couldn't remove this message. Please try again." };
  }
  return {};
}
