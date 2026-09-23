"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildPayhereCheckout, type PayhereCheckoutFields } from "./checkout";
import { getPayhereCheckoutUrl } from "./env";

type CheckoutResult = { error: string } | { fields: PayhereCheckoutFields; checkoutUrl: string };

/**
 * Builds the hidden-field PayHere checkout payload for a payment the caller
 * already created (joinAfterQna/unlockInstitute in batches-actions.ts) —
 * split into its own action rather than folded into those because it needs
 * the request's own origin (for return/cancel/notify URLs) and the
 * student's contact details, neither of which those actions need for
 * anything else.
 */
export async function getPayhereCheckoutFields(paymentId: string, locale: string): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const [{ data: payment }, { data: profile }] = await Promise.all([
    supabase
      .from("platform_payments")
      .select("id, student_id, purpose, amount, payhere_order_id, status")
      .eq("id", paymentId)
      .eq("student_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
  ]);
  if (!payment) {
    return { error: "That payment couldn't be found." };
  }
  if (payment.status !== "pending") {
    return { error: "This payment has already been processed." };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  const itemName =
    payment.purpose === "institute_unlock"
      ? "ClassPortals — Institute unlock fee"
      : payment.purpose === "class_join"
        ? "ClassPortals — Class join fee"
        : "ClassPortals — Teacher connection fee";

  const [firstName, ...rest] = (profile?.full_name ?? "Student").trim().split(/\s+/);
  const fields = buildPayhereCheckout({
    orderId: payment.payhere_order_id,
    amount: payment.amount,
    itemName,
    // The Connections tab's nav key is still "requests" (only its visible
    // label was renamed) — this must match the real key, not the label.
    returnUrl: `${origin}/${locale}/student?tab=requests&payment=success`,
    cancelUrl: `${origin}/${locale}/student?tab=requests&payment=cancelled`,
    notifyUrl: `${origin}/api/payhere/notify`,
    firstName: firstName || "Student",
    lastName: rest.join(" ") || "-",
    email: user.email ?? "",
    phone: profile?.phone ?? "",
    address: "-",
    city: "-",
    country: "Sri Lanka",
  });

  return { fields, checkoutUrl: getPayhereCheckoutUrl() };
}
