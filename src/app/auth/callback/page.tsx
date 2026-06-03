"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { safeNextPath } from "@/lib/safeNextPath";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google sign-in was cancelled or failed. Please try again.",
  oauth_not_configured: "Google sign-in is not configured on the server yet.",
  email_required: "Google did not provide an email address for this account.",
  account_conflict: "This email is linked to another sign-in method.",
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoreSession = useStore((s) => s.restoreSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(ERROR_MESSAGES[oauthError] ?? "Sign-in failed. Please try again.");
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setError("Missing sign-in code. Please try again.");
      return;
    }

    api
      .exchangeOAuthCode(code)
      .then(async () => {
        await restoreSession();
        const next = safeNextPath(searchParams.get("next"));
        router.replace(next ?? "/admin/modes");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      });
  }, [router, searchParams, restoreSession]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] p-4 text-center">
        <p className="max-w-md text-sm text-red-500">{error}</p>
        <Link href="/login" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" aria-label="Completing sign-in" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
