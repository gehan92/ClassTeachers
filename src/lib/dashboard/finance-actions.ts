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

export async function createFeePlanTemplate(input: {
  name: string;
  description: string;
  amount: number;
}): Promise<ActionResult> {
  if (!input.name.trim() || !(input.amount > 0)) {
    return { error: "Enter a name and an amount greater than zero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const { error } = await supabase.from("fee_plan_templates").insert({
    owner_id: instituteId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount: input.amount,
  });
  if (error) return { error: "Couldn't save this template. Please try again." };
  return {};
}

export async function deleteFeePlanTemplate(templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("fee_plan_templates").delete().eq("id", templateId);
  if (error) return { error: "Couldn't delete this template. Please try again." };
  return {};
}

/**
 * Charges every listed student the same description+amount in one go — the
 * term-start "charge everyone the monthly fee" case a single createFeeCharge
 * call can't cover. One insert per student, same shape createFeeCharge
 * already uses; RLS (is_owner) covers every row identically since they all
 * share the same owner_id.
 */
export async function createBulkFeeCharges(input: {
  studentIds: string[];
  batchId: string | null;
  description: string;
  amount: number;
}): Promise<ActionResult> {
  if (input.studentIds.length === 0) {
    return { error: "Select at least one student." };
  }
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

  const { error } = await supabase.from("fee_charges").insert(
    input.studentIds.map((studentId) => ({
      owner_type: "class" as const,
      owner_id: instituteId,
      student_id: studentId,
      batch_id: input.batchId,
      description: input.description.trim(),
      amount: input.amount,
    })),
  );
  if (error) return { error: "Couldn't record these charges. Please try again." };
  return {};
}
