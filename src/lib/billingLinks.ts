/**
 * Public URLs for plan changes and support (set in the admin app env).
 * NEXT_PUBLIC_BILLING_PORTAL_URL: Stripe/customer portal, Paddle, or similar, when available.
 * NEXT_PUBLIC_SUBSCRIPTION_SUPPORT_EMAIL: shown for cancellation and billing questions.
 */

export function getPricingPageUrl(): string {
  if (typeof process === "undefined") return "";
  return process.env.NEXT_PUBLIC_PRICING_URL?.trim() || "";
}

export function getBillingPortalUrl(): string {
  if (typeof process === "undefined") return "";
  return process.env.NEXT_PUBLIC_BILLING_PORTAL_URL?.trim() || "";
}

export function getSubscriptionSupportEmail(): string {
  if (typeof process === "undefined") return "";
  return process.env.NEXT_PUBLIC_SUBSCRIPTION_SUPPORT_EMAIL?.trim() || "support@tunzone.com";
}
