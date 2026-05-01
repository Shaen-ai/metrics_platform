"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration, useRestoreSessionOnMount } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation } from "@/lib/translations";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { LanguagePreferenceButton } from "@/components/LanguagePreferenceButton";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { safeNextPath } from "@/lib/safeNextPath";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, isAuthenticated, currentUser } = useStore();
  const hydrated = useHydration();
  useRestoreSessionOnMount();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { lang } = useLanguagePreference();

  const t = (key: string) => getTranslation(lang, key);

  const nextParam = searchParams.get("next");
  const loginHref =
    typeof nextParam === "string" && nextParam !== ""
      ? `/login?next=${encodeURIComponent(nextParam)}`
      : "/login";

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
      <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8772E]" aria-hidden />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await signup({
      name: formData.name,
      email: formData.email,
      companyName: formData.companyName,
      password: formData.password,
      language: lang,
    });

    if (!result.success) {
      setError(result.error || "Signup failed");
    } else if (result.needsEmailVerification) {
      setEmailSent(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4">
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
          <CardTitle className="text-2xl text-[#1A1A1A]">{t("auth.createAccount")}</CardTitle>
          <p className="mt-2 text-[#6B7280]">
            {t("auth.startBuilding")}
          </p>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center">
              <p className="rounded-lg border border-[#C8E6C9] bg-[#E8F5E9] p-4 text-sm text-[#1A1A1A]">
                {t("auth.signupCheckEmail")}
              </p>
              <Link
                href={loginHref}
                className="inline-block font-medium text-[#E8772E] hover:underline"
              >
                {t("auth.backToSignIn")}
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.name")}
              type="text"
              placeholder={t("auth.namePlaceholder")}
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <Input
              label={t("auth.email")}
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              required
            />
            <Input
              label={t("auth.companyName")}
              type="text"
              placeholder={t("auth.companyNamePlaceholder")}
              value={formData.companyName}
              onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
              required
            />
            <Input
              label={t("auth.password")}
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              required
            />
            <Input
              label={t("auth.confirmPassword")}
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))}
              required
            />
            {error && (
              <p className="rounded bg-red-50 p-2 text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLoading ? t("auth.creatingAccount") : t("auth.signup")}
            </Button>
          </form>
          )}

          {!emailSent && (
          <div className="mt-6 text-center text-sm">
            <p className="text-[#6B7280]">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href={loginHref} className="font-medium text-[#E8772E] hover:underline">
                {t("auth.login")}
              </Link>
            </p>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4 text-[#6B7280]">
          …
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
