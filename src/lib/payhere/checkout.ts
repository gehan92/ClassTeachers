import "server-only";
import crypto from "crypto";
import { getPayhereMerchantId, getPayhereMerchantSecret } from "./env";

function md5Upper(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex").toUpperCase();
}

/**
 * PayHere's documented v1 hosted-checkout hash:
 *   MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret))
 * with the inner MD5(merchant_secret) upper-cased before concatenation, and
 * the whole result upper-cased again. Amount must be formatted to exactly
 * 2 decimals, no thousands separator. NOT verified against a live PayHere
 * sandbox account yet (none configured) — re-confirm this against PayHere's
 * current merchant docs the first time a real checkout is attempted.
 */
function buildHash(orderId: string, amount: number, currency: string): string {
  const merchantId = getPayhereMerchantId();
  const secretHash = md5Upper(getPayhereMerchantSecret());
  return md5Upper(`${merchantId}${orderId}${amount.toFixed(2)}${currency}${secretHash}`);
}

export type PayhereCheckoutFields = Record<string, string>;

/**
 * Builds the hidden-field payload for PayHere's hosted checkout form. The
 * caller renders these as hidden <input>s in a <form method="post" action=
 * {checkoutUrl}> and submits it (see the client-side checkout screen) —
 * PayHere itself hosts the actual card-entry page, nothing sensitive ever
 * touches this app's own servers.
 */
export function buildPayhereCheckout(params: {
  orderId: string;
  amount: number;
  itemName: string;
  currency?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}): PayhereCheckoutFields {
  const currency = params.currency ?? "LKR";
  return {
    merchant_id: getPayhereMerchantId(),
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    order_id: params.orderId,
    items: params.itemName,
    currency,
    amount: params.amount.toFixed(2),
    first_name: params.firstName,
    last_name: params.lastName,
    email: params.email,
    phone: params.phone,
    address: params.address,
    city: params.city,
    country: params.country,
    hash: buildHash(params.orderId, params.amount, currency),
  };
}
