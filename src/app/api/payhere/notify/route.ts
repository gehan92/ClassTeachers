import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayhereNotifySignature } from "@/lib/payhere/verify-notify";

/**
 * PayHere's server-to-server payment confirmation (notify_url) — the only
 * unauthenticated POST route in this codebase (no session/cookie exists for
 * PayHere's own servers to send). The MD5 signature IS the authentication,
 * same shape as submit_inquiry's anon-writable-but-guarded precedent
 * (0037), just verified in the route handler instead of a SQL function.
 *
 * Always returns 200 regardless of internal outcome — PayHere retries on
 * any non-2xx response, and a retry must be safe (mark_payment_completed
 * is itself idempotent on payhere_order_id). Failures are logged
 * server-side, not surfaced to the caller.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const merchantId = String(form.get("merchant_id") ?? "");
  const orderId = String(form.get("order_id") ?? "");
  const payhereAmount = String(form.get("payhere_amount") ?? "");
  const payhereCurrency = String(form.get("payhere_currency") ?? "");
  const statusCode = String(form.get("status_code") ?? "");
  const md5sig = String(form.get("md5sig") ?? "");
  const paymentId = String(form.get("payment_id") ?? "");

  if (!orderId || !md5sig) {
    console.error("payhere notify: missing required fields");
    return NextResponse.json({ ok: true });
  }

  const verified = verifyPayhereNotifySignature({ merchantId, orderId, payhereAmount, payhereCurrency, statusCode, md5sig });
  if (!verified) {
    console.error("payhere notify: signature verification failed", { orderId });
    return NextResponse.json({ ok: true });
  }

  // 2 = success on PayHere's status_code scale; anything else (pending,
  // cancelled, failed, chargedback) is not a completion — no cascade.
  if (statusCode !== "2") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("mark_payment_completed", {
    p_payhere_order_id: orderId,
    p_payhere_payment_id: paymentId,
  });
  if (error) {
    console.error("payhere notify: mark_payment_completed failed", { orderId, error: error.message });
  }

  return NextResponse.json({ ok: true });
}
