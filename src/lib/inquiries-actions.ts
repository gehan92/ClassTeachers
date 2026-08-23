"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const replySchema = z.object({
  id: z.string().uuid(),
  reply: z.string().trim().min(1),
});

/**
 * A single reply, not a thread — the sender may not even have an account
 * (anonymous inquiries are allowed, 0037), so there's nowhere for a
 * back-and-forth to live on their side. This just closes the loop on the
 * teacher's end of the original one-way contact form.
 */
export async function replyToInquiry(id: string, reply: string): Promise<ActionResult> {
  const parsed = replySchema.safeParse({ id, reply });
  if (!parsed.success) {
    return { error: "Please write a reply first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("inquiries")
    .update({ reply: parsed.data.reply, replied_at: new Date().toISOString(), status: "read" })
    .eq("id", parsed.data.id);
  if (error) {
    return { error: "Couldn't send your reply. Please try again." };
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
