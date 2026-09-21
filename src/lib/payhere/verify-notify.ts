import "server-only";
import crypto from "crypto";
import { getPayhereMerchantId, getPayhereMerchantSecret } from "./env";

function md5Upper(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex").toUpperCase();
}

/**
 * PayHere's documented notify_url signature check:
 *   MD5(merchant_id + order_id + payhere_amount + payhere_currency +
 *       status_code + MD5(merchant_secret))
 * (inner MD5 upper-cased, whole result upper-cased). This is what
 * authenticates the webhook — there is no session/cookie, so a request
 * whose computed signature doesn't match the one PayHere sent is rejected
 * outright. NOT verified against a live PayHere sandbox yet; re-confirm
 * against PayHere's current merchant docs before relying on this in
 * production.
 */
export function verifyPayhereNotifySignature(payload: {
  merchantId: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
  md5sig: string;
}): boolean {
  if (payload.merchantId !== getPayhereMerchantId()) {
    return false;
  }
  const secretHash = md5Upper(getPayhereMerchantSecret());
  const expected = md5Upper(
    `${payload.merchantId}${payload.orderId}${payload.payhereAmount}${payload.payhereCurrency}${payload.statusCode}${secretHash}`,
  );
  return expected === payload.md5sig.toUpperCase();
}
