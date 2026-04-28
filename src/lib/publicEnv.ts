const DEFAULT_DEV_API = "http://localhost:8000/api";

function withoutTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Laravel `/api` base (same as published app in production). */
export function getPublicApiUrl(): string {
  return withoutTrailingSlashes(process.env.NEXT_PUBLIC_API_URL || DEFAULT_DEV_API);
}

export const publicApiUrl = getPublicApiUrl();
