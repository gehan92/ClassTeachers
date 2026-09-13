"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function createFeeCharge(input: {
  studentId: string;
  batchId: string | null;
  description: string;
  amount: number;
}): Promise<ActionResult> {
  if (!input.description.trim() || !(input.amount > 0)) {
    return { error: "Enter a description and an amount greater than zero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("fee_charges").insert({
    owner_type: "class",
    owner_id: instituteId,
    student_id: input.studentId,
    batch_id: input.batchId,
    description: input.description.trim(),
    amount: input.amount,
  });
  if (error) return { error: "Couldn't record this charge. Please try again." };
  return {};
}

export async function deleteFeeCharge(chargeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("fee_charges").delete().eq("id", chargeId);
  if (error) return { error: "Couldn't delete this charge. Please try again." };
  return {};
}

export async function createFeePayment(input: {
  studentId: string;
  chargeId: string | null;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "other";
  note: string;
}): Promise<ActionResult> {
  if (!(input.amount > 0)) {
    return { error: "Enter an amount greater than zero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("fee_payments").insert({
    owner_type: "class",
    owner_id: instituteId,
    student_id: input.studentId,
    charge_id: input.chargeId,
    amount: input.amount,
    method: input.method,
    note: input.note.trim() || null,
    recorded_by: user.id,
  });
  if (error) return { error: "Couldn't record this payment. Please try again." };
  return {};
}

export async function deleteFeePayment(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("fee_payments").delete().eq("id", paymentId);
  if (error) return { error: "Couldn't delete this payment. Please try again." };
  return {};
}
