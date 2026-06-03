"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration, useRestoreSessionOnMount } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation, localizeAuthApiError } from "@/lib/translations";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { LanguagePreferenceButton } from "@/components/LanguagePreferenceButton";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { safeNextPath } from "@/lib/safeNextPath";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, currentUser } = useStore();
  const hydrated = useHydration();
  useRestoreSessionOnMount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { lang } = useLanguagePreference();

  const t = (key: string) => getTranslation(lang, key);

  const verified = searchParams.get("verified");
  const verification = searchParams.get("verification");
  const passwordReset = searchParams.get("reset");
  const billingSuccess = searchParams.get("billing") === "success";

  const nextParam = searchParams.get("next");
  const signupHref =
    typeof nextParam === "string" && nextParam !== ""
      ? `/signup?next=${encodeURIComponent(nextParam)}`
      : "/signup";

  const infoMessage =
    billingSuccess
      ? t("auth.billingSuccess")
      : verified === "1"
      ? t("auth.emailVerified")
      : verification === "invalid"
        ? t("auth.verificationInvalid")
        : verification === "already"
          ? t("auth.alreadyVerified")
          : passwordReset === "1"
            ? t("auth.passwordResetDone")
            : null;

  useEffect(() => {
    if (!hydrated) return;

    if (isAuthenticated) {
      const next = safeNextPath(searchParams.get("next"));
      if (next) {
        router.push(next);
        return;
      }
      if (currentUser?.selectedModeId && currentUser?.selectedSubModeIds?.length) {
        router.push("/admin");
      } else {
        router.push("/admin/modes");
      }
    }
  }, [hydrated, isAuthenticated, currentUser, router, searchParams]);

  if (!hydrated || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" aria-hidden />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await login({ email, password });
    if (!result.success) {
      const raw = result.error || "Login failed";
      setError(localizeAuthApiError(lang, raw));
    }
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <LanguagePreferenceButton className="absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]" />
      <Card className="w-full max-w-md rounded-2xl border-[var(--border)] shadow-sm">
        <CardHeader className="items-center text-center">
          <Link
            href={getLandingUrl()}
            className="relative mb-4 h-[200px] w-[min(100%,220px)] shrink-0 rounded-md outline-offset-4 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            aria-label={t("auth.logoHomeAria")}
          >
            <Image
              src="/logo.png"
              alt=""
              fill
              className="object-contain object-center"
              sizes="220px"
              priority
            />
          </Link>
          <CardTitle className="text-2xl text-[var(--foreground)]">{t("auth.welcomeBack")}</CardTitle>
          <p className="text-[var(--muted-foreground)] mt-2">
            {t("auth.signInToAccount")}
          </p>
        </CardHeader>
        <CardContent>
          {infoMessage && (
            <p className="text-sm text-[var(--foreground)] bg-[#E8F5E9] border border-[#C8E6C9] p-3 rounded-lg mb-4">
              {infoMessage}
            </p>
          )}
          <div className="mb-4">
            <GoogleSignInButton label={t("auth.continueWithGoogle")} />
          </div>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="space-y-1">
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--primary)] hover:underline font-medium"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <Input
                label={t("auth.password")}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLoading ? t("auth.signingIn") : t("auth.login")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-[var(--muted-foreground)]">
              {t("auth.dontHaveAccount")}{" "}
              <Link href={signupHref} className="text-[var(--primary)] hover:underline font-medium">
                {t("auth.signup")}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 text-[var(--muted-foreground)]">
          …
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
