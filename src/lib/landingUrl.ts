/**
 * Marketing site (landing) origin, no trailing slash. Auth pages link the logo here.
 *
 * NEXT_PUBLIC_LANDING_URL overrides everything.
 * Production without env defaults to the live marketing host.
 * Development defaults to landing `next dev --port 3002`.
 */
const DEFAULT_PRODUCTION_LANDING = "https://tunzone.com";
const DEFAULT_DEV_LANDING = "http://localhost:3002";

export function getLandingUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_LANDING_URL ?? "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return DEFAULT_PRODUCTION_LANDING;
  return DEFAULT_DEV_LANDING;
}
