/**
 * Same fail-fast pattern as src/lib/supabase/env.ts. PAYHERE_MERCHANT_ID/
 * SECRET are server-only (never NEXT_PUBLIC_*) — the checkout form is built
 * server-side (a server action) and only the resulting hash/fields are
 * handed to the client, never the secret itself.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your PayHere merchant ` +
        `credentials (PayHere dashboard -> Integrations) before this feature can process a payment.`,
    );
  }
  return value;
}

export function getPayhereMerchantId(): string {
  return requireEnv("PAYHERE_MERCHANT_ID", process.env.PAYHERE_MERCHANT_ID);
}

export function getPayhereMerchantSecret(): string {
  return requireEnv("PAYHERE_MERCHANT_SECRET", process.env.PAYHERE_MERCHANT_SECRET);
}

/** Defaults to sandbox so a missing env var can't accidentally take real payments. */
export function isPayhereLiveMode(): boolean {
  return process.env.PAYHERE_MODE === "live";
}

export function getPayhereCheckoutUrl(): string {
  return isPayhereLiveMode() ? "https://www.payhere.lk/pay/checkout" : "https://sandbox.payhere.lk/pay/checkout";
}
