"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation, LanguageCode, languages } from "@/lib/translations";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";

export default function SignupPage() {
  const router = useRouter();
  const { signup, isAuthenticated } = useStore();
  const hydrated = useHydration();
  const [lang, setLang] = useState<LanguageCode>("en");
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
    });

    if (!result.success) {
      setError(result.error || "Signup failed");
    } else if (result.needsEmailVerification) {
      setEmailSent(true);
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
          {/* Language Selector */}
          <div className="flex justify-center gap-2 mb-4">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`text-xl p-1 rounded-lg ${
                  lang === l.code ? "bg-[#FEF3E7] ring-2 ring-[#E8772E]" : ""
                }`}
                title={l.name}
              >
                {l.flag}
              </button>
            ))}
          </div>
          <CardTitle className="text-2xl text-[#1A1A1A]">{t("auth.createAccount")}</CardTitle>
          <p className="text-[#6B7280] mt-2">
            {t("auth.startBuilding")}
          </p>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[#1A1A1A] bg-[#E8F5E9] border border-[#C8E6C9] p-4 rounded-lg">
                {t("auth.signupCheckEmail")}
              </p>
              <Link
                href="/login"
                className="inline-block text-[#E8772E] font-medium hover:underline"
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
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
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
              <Link href="/login" className="text-[#E8772E] hover:underline font-medium">
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
