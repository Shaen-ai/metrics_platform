"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getTranslation, LanguageCode, languages } from "@/lib/translations";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, currentUser } = useStore();
  const hydrated = useHydration();
  const [lang, setLang] = useState<LanguageCode>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = (key: string) => getTranslation(lang, key);

  const verified = searchParams.get("verified");
  const verification = searchParams.get("verification");
  const passwordReset = searchParams.get("reset");

  const infoMessage =
    verified === "1"
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
      if (currentUser?.selectedModeId && currentUser?.selectedSubModeIds?.length) {
        router.push("/admin");
      } else {
        router.push("/admin/modes");
      }
    }
  }, [hydrated, isAuthenticated, currentUser, router]);

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
      setError(result.error || "Login failed");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
      <Card className="w-full max-w-md rounded-2xl border-[#F0E6D8] shadow-sm">
        <CardHeader className="text-center">
          {/* Logo Badge */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E8772E] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-2xl">T</span>
          </div>
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
                type="button"
              >
                {l.flag}
              </button>
            ))}
          </div>
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
              placeholder="demo@example.com"
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

          <div className="mt-4 p-3 bg-[#FEF3E7] rounded-xl text-sm">
            <p className="font-medium mb-1 text-[#1A1A1A]">{t("auth.demoCredentials")}:</p>
            <p className="text-[#6B7280]">
              {t("auth.email")}: demo@example.com
            </p>
            <p className="text-[#6B7280]">
              {t("auth.password")}: demo123
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
