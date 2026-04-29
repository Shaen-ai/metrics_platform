"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, useHydration } from "@/lib/store";
import { api } from "@/lib/api";
import { getLandingUrl } from "@/lib/landingUrl";

const VALID_TIERS = ["starter", "business", "business-pro"] as const;
type BillingTier = (typeof VALID_TIERS)[number];

const VALID_INTERVALS = ["month", "year"] as const;

function parseBillingParams(searchParams: URLSearchParams): {
  tier: BillingTier;
  interval: "month" | "year";
} | null {
  const tier = searchParams.get("tier");
  const interval = searchParams.get("interval");
  if (!tier || !interval) return null;
  if (!VALID_TIERS.includes(tier as BillingTier)) return null;
  if (!VALID_INTERVALS.includes(interval as "month" | "year")) return null;

  return {
    tier: tier as BillingTier,
    interval: interval as "month" | "year",
  };
}

function BillingStartInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useStore();
  const hydrated = useHydration();
  const checkoutStarted = useRef(false);
  const loginRedirectSent = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseBillingParams(searchParams);
  const landingPricing = `${getLandingUrl()}/pricing`;

  useEffect(() => {
    if (!hydrated || !parsed || !isAuthenticated) return;
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;

    api
      .getStripeCheckoutUrl(parsed.tier, parsed.interval)
      .then(({ url }) => {
        window.location.assign(url);
      })
      .catch((e: unknown) => {
        checkoutStarted.current = false;
        setError(e instanceof Error ? e.message : "Checkout failed");
      });
  }, [hydrated, isAuthenticated, parsed]);

  useEffect(() => {
    if (!hydrated || !parsed || isAuthenticated) return;
    if (loginRedirectSent.current) return;
    loginRedirectSent.current = true;
    const next = `/billing/start?tier=${parsed.tier}&interval=${parsed.interval}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [hydrated, isAuthenticated, parsed, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
        …
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFF8F0] p-4 text-center">
        <p className="text-[#1A1A1A]">Invalid or missing plan parameters.</p>
        <Link
          href={landingPricing}
          className="font-medium text-[#E8772E] underline"
        >
          View pricing
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFF8F0] p-4 text-center">
        <p className="max-w-md text-red-600">{error}</p>
        <button
          type="button"
          className="rounded-full bg-[#E8772E] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            checkoutStarted.current = false;
            setError(null);
            api
              .getStripeCheckoutUrl(parsed.tier, parsed.interval)
              .then(({ url }) => window.location.assign(url))
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : "Checkout failed"),
              );
          }}
        >
          Try again
        </button>
        <Link
          href={landingPricing}
          className="text-sm font-medium text-[#E8772E] underline"
        >
          Back to pricing
        </Link>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
        Redirecting to sign in…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
      Redirecting to secure checkout…
    </div>
  );
}

export default function BillingStartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
          …
        </div>
      }
    >
      <BillingStartInner />
    </Suspense>
  );
}
