"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation, localizeAuthApiError } from "@/lib/translations";
import { AUTH_PAGE_LANG } from "@/lib/authPageLang";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    if (decoded.includes("://")) return null;
    return decoded;
  } catch {
    return null;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, currentUser } = useStore();
  const hydrated = useHydration();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = (key: string) => getTranslation(AUTH_PAGE_LANG, key);

  const verified = searchParams.get("verified");
  const verification = searchParams.get("verification");
  const passwordReset = searchParams.get("reset");
  const billingSuccess = searchParams.get("billing") === "success";

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
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await login({ email, password });
    if (!result.success) {
      const raw = result.error || "Login failed";
      setError(localizeAuthApiError(AUTH_PAGE_LANG, raw));
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
      <Card className="w-full max-w-md rounded-2xl border-[#F0E6D8] shadow-sm">
        <CardHeader className="items-center text-center">
          <Link
            href={getLandingUrl()}
            className="relative mb-4 h-[200px] w-[min(100%,220px)] shrink-0 rounded-md outline-offset-4 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8772E]"
            aria-label={t("auth.logoHomeAria")}
          >
            <Image
              src="/tunzone-logo.png"
              alt=""
              fill
              className="object-contain object-center"
              sizes="220px"
              priority
            />
          </Link>
          <CardTitle className="text-2xl text-[#1A1A1A]">{t("auth.welcomeBack")}</CardTitle>
          <p className="text-[#6B7280] mt-2">
            {t("auth.signInToAccount")}
          </p>
        </CardHeader>
        <CardContent>
          {infoMessage && (
            <p className="text-sm text-[#1A1A1A] bg-[#E8F5E9] border border-[#C8E6C9] p-3 rounded-lg mb-4">
              {infoMessage}
            </p>
          )}
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
                  className="text-sm text-[#E8772E] hover:underline font-medium"
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
            <p className="text-[#6B7280]">
              {t("auth.dontHaveAccount")}{" "}
              <Link href="/signup" className="text-[#E8772E] hover:underline font-medium">
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
        <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
          …
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
