"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation } from "@/lib/translations";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { LanguagePreferenceButton } from "@/components/LanguagePreferenceButton";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, isAuthenticated } = useStore();
  const hydrated = useHydration();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { lang } = useLanguagePreference();

  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const t = (key: string) => getTranslation(lang, key);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.push("/admin/modes");
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || isAuthenticated) {
    return null;
  }

  if (!email || !token) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
        <LanguagePreferenceButton className="absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-[#F0E6D8] bg-white px-3 py-2 text-sm text-[#6B7280] shadow-sm transition-colors hover:border-[#E8772E] hover:text-[#E8772E]" />
        <Card className="w-full max-w-md rounded-2xl border-[#F0E6D8] shadow-sm p-6 text-center">
          <p className="text-[#6B7280] mb-4">{t("auth.verificationInvalid")}</p>
          <Link href="/forgot-password" className="text-[#E8772E] font-medium hover:underline">
            {t("auth.forgotPasswordTitle")}
          </Link>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsLoading(true);
    const result = await resetPassword({
      email,
      token,
      password,
      password_confirmation: confirmPassword,
    });
    if (result.success) {
      router.push("/login?reset=1");
    } else {
      setError(result.error || "Reset failed");
    }
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
      <LanguagePreferenceButton className="absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-[#F0E6D8] bg-white px-3 py-2 text-sm text-[#6B7280] shadow-sm transition-colors hover:border-[#E8772E] hover:text-[#E8772E]" />
      <Card className="w-full max-w-md rounded-2xl border-[#F0E6D8] shadow-sm">
        <CardHeader className="items-center text-center">
          <Link
            href={getLandingUrl()}
            className="relative mb-4 h-[200px] w-[min(100%,220px)] shrink-0 rounded-md outline-offset-4 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8772E]"
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
          <CardTitle className="text-2xl text-[#1A1A1A]">{t("auth.setNewPassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Input
              label={t("auth.confirmPassword")}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLoading ? t("auth.resettingPassword") : t("auth.saveNewPassword")}
            </Button>
            <div className="text-center text-sm">
              <Link href="/login" className="text-[#E8772E] hover:underline font-medium">
                {t("auth.backToSignIn")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
          …
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
