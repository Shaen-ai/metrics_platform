"use client";

import { useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { Box, Sparkles, X, ArrowUpRight, CalendarClock } from "lucide-react";

const DEFAULT_PRICING_URL = "/admin/settings";

function pricingHref(): string {
  if (typeof process === "undefined") return DEFAULT_PRICING_URL;
  return process.env.NEXT_PUBLIC_PRICING_URL?.trim() || DEFAULT_PRICING_URL;
}

interface Image3dUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown when Image-to-3D monthly quota is exhausted (API 429 or entitlements at 0).
 */
export function Image3dUpgradeModal({ open, onClose }: Image3dUpgradeModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleKeyDown]);

  if (!visible) return null;

  const href = pricingHref();
  const external = /^https?:\/\//i.test(href);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className={cn(
          "absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image3d-upgrade-title"
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/95 via-white to-white shadow-2xl shadow-violet-500/10 transition-all duration-200 dark:border-violet-500/20 dark:from-violet-950/90 dark:via-slate-950 dark:to-slate-950",
          animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2",
        )}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10" />
          <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl dark:bg-fuchsia-500/5" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-violet-100/80 hover:text-slate-800 dark:hover:bg-violet-900/50 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pt-10">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 p-[1px] shadow-lg shadow-violet-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white dark:bg-slate-950">
                <div className="relative">
                  <Box className="h-7 w-7 text-violet-600 dark:text-violet-400" strokeWidth={1.75} />
                  <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-400" fill="currentColor" />
                </div>
              </div>
            </div>

            <h2
              id="image3d-upgrade-title"
              className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              Image-to-3D limit reached
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              You&apos;ve used all Image-to-3D generations included in your plan for this month. Upgrade
              to create more 3D models from photos, or try again when your usage resets.
            </p>
          </div>

          <ul className="mb-6 space-y-2.5 rounded-xl border border-violet-100/80 bg-white/60 px-4 py-3 text-left text-sm text-slate-700 dark:border-violet-500/15 dark:bg-violet-950/20 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <span>Higher monthly Image-to-3D caps on Growth, Scale, and Enterprise.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <span>Usage resets at the start of each billing month—your current tier applies until then.</span>
            </li>
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={onClose}>
              Not now
            </Button>
            <a
              href={href}
              {...(external
                ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
                : {})}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-opacity hover:opacity-95"
            >
              View plans
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isImage3dLimitReached(message: string, httpStatus: number): boolean {
  if (httpStatus === 429) return true;
  const m = message.toLowerCase();
  return (
    m.includes("limit") && (m.includes("plan") || m.includes("month") || m.includes("image-to-3d") || m.includes("3d"))
  ) || m.includes("quota exceeded");
}
