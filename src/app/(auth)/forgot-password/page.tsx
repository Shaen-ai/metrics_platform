"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation } from "@/lib/translations";
import { AUTH_PAGE_LANG } from "@/lib/authPageLang";
import { getLandingUrl } from "@/lib/landingUrl";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, isAuthenticated } = useStore();
  const hydrated = useHydration();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const t = (key: string) => getTranslation(AUTH_PAGE_LANG, key);

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
    setIsLoading(true);
    const result = await forgotPassword(email);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Request failed");
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
              src="/logo.png"
              alt=""
              fill
              className="object-contain object-center"
              sizes="220px"
              priority
            />
          </Link>
          <CardTitle className="text-2xl text-[#1A1A1A]">{t("auth.forgotPasswordTitle")}</CardTitle>
          <p className="text-[#6B7280] mt-2 text-sm">
            {t("auth.forgotPasswordHint")}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[#1A1A1A] bg-[#E8F5E9] border border-[#C8E6C9] p-3 rounded-lg">
                {t("auth.checkEmailInbox")}
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
                label={t("auth.email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
              )}
              <Button type="submit" className="w-full" isLoading={isLoading}>
                {isLoading ? t("auth.sendingReset") : t("auth.sendResetLink")}
              </Button>
              <div className="text-center text-sm">
                <Link href="/login" className="text-[#E8772E] hover:underline font-medium">
                  {t("auth.backToSignIn")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
