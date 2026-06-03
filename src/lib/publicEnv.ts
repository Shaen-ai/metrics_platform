const DEFAULT_DEV_API = "http://localhost:8000/api";

function withoutTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Laravel `/api` base (same as published app in production). */
export function getPublicApiUrl(): string {
  return withoutTrailingSlashes(process.env.NEXT_PUBLIC_API_URL || DEFAULT_DEV_API);
}

export const publicApiUrl = getPublicApiUrl();

/** Laravel origin for browser OAuth redirects (no `/api` suffix). */
export function getLaravelOAuthOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_DEV_API;
  return raw.replace(/\/api\/?$/, "").replace(/\/+$/, "") || "http://localhost:8000";
}

export function getGoogleOAuthRedirectUrl(intent: "admin" | "vista" = "admin"): string {
  return `${getLaravelOAuthOrigin()}/auth/social/google/redirect?intent=${intent}`;
}
