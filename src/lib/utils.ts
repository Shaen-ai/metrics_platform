import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = "USD"): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    AMD: "֏",
    RUB: "₽",
  };
  
  const symbol = symbols[currency] || currency;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
  
  // AMD and RUB typically show symbol after the amount
  if (currency === "AMD" || currency === "RUB") {
    return `${formatted} ${symbol}`;
  }
  
  return `${symbol}${formatted}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Strips the backend origin from storage URLs so they go through the
 * Next.js rewrite proxy (avoiding CORS for static assets).
 */
export function toRelativeStorageUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.pathname.startsWith("/storage/")) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    // not a valid absolute URL — return as-is
  }
  return trimmed;
}
