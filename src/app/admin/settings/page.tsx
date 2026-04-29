"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui";
import {
  Copy,
  Check,
  ExternalLink,
  Globe,
  Store,
  CreditCard,
  Layers,
  LayoutGrid,
  Crown,
  Palette,
  Upload,
  Loader2,
  UserRound,
} from "lucide-react";
import { languages, normalizeLanguageCode } from "@/lib/translations";
import { currencies } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getBillingPortalUrl,
  getPricingPageUrl,
  getSubscriptionSupportEmail,
} from "@/lib/billingLinks";
import { DEFAULT_PUBLIC_SITE_LAYOUT, publicSiteLayouts, publicSiteTextFields } from "@/lib/publicSite";
import type { PublicSiteTexts } from "@/lib/types";
import { api } from "@/lib/api";
import { uploadErrorUserMessage } from "@/lib/uploadLimits";
import { buildPublishedStorefrontUrl, getStorefrontRootDomain } from "@/lib/storefrontUrl";
import { getLandingUrl } from "@/lib/landingUrl";

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeSubdomainInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

const SETTINGS_TABS = ["storefront", "billing", "account", "appearance", "planners"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(searchParams: URLSearchParams): SettingsTab {
  const v = searchParams.get("tab");
  if (v && (SETTINGS_TABS as readonly string[]).includes(v)) {
    return v as SettingsTab;
  }
  return "storefront";
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto p-10 flex justify-center items-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#E8772E]" aria-hidden />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { t } = useTranslation();
  const {
    currentUser,
    updateUser,
    publishSite,
    refreshProfile,
    getModeById,
    getSubModesByIds,
    fetchMaterials,
    materials,
  } = useStore();
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    companyName: currentUser?.companyName || "",
    logo: currentUser?.logo || "",
  });
  const [paypalEmail, setPaypalEmail] = useState(currentUser?.paypalEmail || "");
  const [paypalSaving, setPaypalSaving] = useState(false);
  const [paypalSaved, setPaypalSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [siteLayout, setSiteLayout] = useState(currentUser?.publicSiteLayout || DEFAULT_PUBLIC_SITE_LAYOUT);
  const [siteTexts, setSiteTexts] = useState<PublicSiteTexts>(currentUser?.publicSiteTexts || {});
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteSaved, setSiteSaved] = useState(false);

  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  );

  const [plannerRestrict, setPlannerRestrict] = useState(false);
  const [plannerSelection, setPlannerSelection] = useState<Set<string>>(new Set());
  const [plannerSaving, setPlannerSaving] = useState(false);
  const [plannerSaved, setPlannerSaved] = useState(false);

  const [customCatalogOnly, setCustomCatalogOnly] = useState(false);
  const [catalogModeSaving, setCatalogModeSaving] = useState(false);
  const [catalogModeSaved, setCatalogModeSaved] = useState(false);

  const [subdomainDraft, setSubdomainDraft] = useState("");
  const [subdomainAvail, setSubdomainAvail] = useState<"idle" | "checking" | "yes" | "no">("idle");
  const [copiedPublished, setCopiedPublished] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [subdomainSaveBusy, setSubdomainSaveBusy] = useState(false);
  const [subdomainSaveError, setSubdomainSaveError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = parseSettingsTab(searchParams);

  const selectTab = (tab: SettingsTab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  useEffect(() => {
    fetchMaterials().catch(() => {});
  }, [fetchMaterials]);

  useEffect(() => {
    if (currentUser?.slug) {
      setSubdomainDraft(currentUser.slug);
    }
  }, [currentUser?.slug]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const ids = currentUser?.plannerMaterialIds;
    if (ids && ids.length > 0) {
      setPlannerRestrict(true);
      setPlannerSelection(new Set(ids));
    } else {
      setPlannerRestrict(false);
      setPlannerSelection(new Set());
    }
  }, [currentUser?.plannerMaterialIds]);

  useEffect(() => {
    setCustomCatalogOnly(currentUser?.useCustomPlannerCatalog === true);
  }, [currentUser?.useCustomPlannerCatalog]);

  useEffect(() => {
    setSiteLayout(currentUser?.publicSiteLayout || DEFAULT_PUBLIC_SITE_LAYOUT);
    setSiteTexts(currentUser?.publicSiteTexts || {});
  }, [currentUser?.publicSiteLayout, currentUser?.publicSiteTexts]);

  useEffect(() => {
    if (!plannerRestrict || sortedMaterials.length === 0) return;
    setPlannerSelection((prev) => {
      if (prev.size > 0) return prev;
      return new Set(sortedMaterials.map((m) => m.id));
    });
  }, [plannerRestrict, sortedMaterials]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const n = normalizeSubdomainInput(subdomainDraft);
    const formatOk = n.length > 0 && SUBDOMAIN_REGEX.test(n);
    if (!formatOk) {
      setSubdomainAvail("idle");
      return;
    }
    const h = setTimeout(() => {
      setSubdomainAvail("checking");
      api
        .checkSubdomainAvailability(n)
        .then(({ available }) => setSubdomainAvail(available ? "yes" : "no"))
        .catch(() => setSubdomainAvail("idle"));
    }, 400);
    return () => clearTimeout(h);
  }, [subdomainDraft, currentUser?.id]);

  if (!currentUser) return null;

  const ent = currentUser.entitlements;
  const planTier = ent?.planTier ?? currentUser.planTier ?? "free";
  const planTierKey = `settings.plan.tier.${planTier}` as const;
  let planLabel = t(planTierKey);
  if (planLabel === planTierKey) {
    planLabel = planTier ? `${t("settings.plan.unknown")} (${planTier})` : t("settings.plan.tier.free");
  }
  const pricingUrl = getPricingPageUrl();
  const effectivePricingUrl = (pricingUrl || `${getLandingUrl()}/pricing`).trim();
  const billingPortalUrl = getBillingPortalUrl();
  const supportEmail = getSubscriptionSupportEmail();
  const onTrial = ent?.onTrial === true;
  const trialIso = ent?.trialEndsAt ?? currentUser.trialEndsAt;
  const trialDateStr =
    onTrial && trialIso
      ? new Date(trialIso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : null;

  const effectiveLanguage = normalizeLanguageCode(currentUser.language);
  const canUsePublishedLayouts = currentUser.entitlements?.publishedLayouts === true;
  const canUseBespokeDesign = currentUser.entitlements?.bespokeDesign === true;

  const selectedMode = currentUser.selectedModeId
    ? getModeById(currentUser.selectedModeId)
    : null;
  const selectedSubModes =
    currentUser.selectedModeId && currentUser.selectedSubModeIds?.length
      ? getSubModesByIds(currentUser.selectedModeId, currentUser.selectedSubModeIds)
      : [];

  const isSitePublished = Boolean(currentUser.sitePublishedAt);
  const storefrontRoot = getStorefrontRootDomain();
  const normalizedSubdomain = normalizeSubdomainInput(subdomainDraft);
  const subdomainFormatOk =
    normalizedSubdomain.length > 0 && SUBDOMAIN_REGEX.test(normalizedSubdomain);
  const canSubscribePublish = currentUser.entitlements?.subscriptionActive === true;
  const subdomainOkToProceed =
    subdomainFormatOk &&
    subdomainAvail !== "checking" &&
    subdomainAvail !== "no" &&
    (subdomainAvail === "yes" || normalizedSubdomain === currentUser.slug);

  const publishedStoreUrl = buildPublishedStorefrontUrl(currentUser.slug);

  const handleCopyPublishedUrl = () => {
    navigator.clipboard.writeText(publishedStoreUrl);
    setCopiedPublished(true);
    setTimeout(() => setCopiedPublished(false), 2000);
  };

  const handlePublishSite = async () => {
    setPublishError(null);
    if (!subdomainFormatOk) {
      setPublishError(t("settings.subdomainInvalid"));
      return;
    }
    if (subdomainAvail === "no") {
      setPublishError(t("settings.subdomainUnavailable"));
      return;
    }
    setPublishBusy(true);
    try {
      const body: { slug?: string } = {};
      if (normalizedSubdomain !== currentUser.slug) {
        body.slug = normalizedSubdomain;
      }
      await publishSite(Object.keys(body).length ? body : undefined);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : t("settings.publishError"));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleSaveSubdomain = async () => {
    setSubdomainSaveError(null);
    if (!subdomainFormatOk) {
      setSubdomainSaveError(t("settings.subdomainInvalid"));
      return;
    }
    if (subdomainAvail === "no") {
      setSubdomainSaveError(t("settings.subdomainUnavailable"));
      return;
    }
    if (normalizedSubdomain === currentUser.slug) return;
    setSubdomainSaveBusy(true);
    try {
      await updateUser({ slug: normalizedSubdomain });
    } catch (e) {
      setSubdomainSaveError(e instanceof Error ? e.message : t("settings.publishError"));
    } finally {
      setSubdomainSaveBusy(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateUser(formData);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      setFormData((p) => ({ ...p, logo: url }));
      await updateUser({ logo: url });
    } catch (err) {
      setLogoError(uploadErrorUserMessage(err, t));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    setLogoError(null);
    setFormData((p) => ({ ...p, logo: "" }));
    await updateUser({ logo: "" });
  };

  const handleLanguageChange = (lang: string) => {
    updateUser({ language: lang as "en" | "ru" }).catch(console.error);
  };

  const handleCurrencyChange = (currency: string) => {
    updateUser({ currency }).catch(console.error);
  };

  const handleSavePublicSite = async () => {
    setSiteSaving(true);
    try {
      await updateUser({
        publicSiteLayout: canUsePublishedLayouts ? siteLayout : DEFAULT_PUBLIC_SITE_LAYOUT,
        publicSiteTexts: siteTexts,
      });
      setSiteSaved(true);
      setTimeout(() => setSiteSaved(false), 2000);
    } finally {
      setSiteSaving(false);
    }
  };

  const tabItems: { id: SettingsTab; label: string; icon: LucideIcon }[] = [
    { id: "storefront", label: t("settings.tabs.storefront"), icon: Store },
    { id: "billing", label: t("settings.tabs.billing"), icon: Crown },
    { id: "account", label: t("settings.tabs.account"), icon: UserRound },
    { id: "appearance", label: t("settings.tabs.appearance"), icon: Palette },
    { id: "planners", label: t("settings.tabs.planners"), icon: Layers },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{t("settings.title")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("settings.description")}</p>
      </div>

      <nav
        className="sticky top-0 z-20 -mx-1 px-1 py-1 sm:static sm:py-0 bg-[#FFF8F0]/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none"
        aria-label={t("settings.tabsNavLabel")}
      >
        <div
          className="flex gap-1 p-1.5 rounded-2xl bg-white border border-[#F0E6D8] shadow-sm overflow-x-auto overscroll-x-contain"
          role="tablist"
        >
          {tabItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              id={`settings-tab-${id}`}
              onClick={() => selectTab(id)}
              className={cn(
                "shrink-0 flex items-center gap-2 rounded-xl px-3 sm:px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === id
                  ? "bg-[#FEF3E7] text-[#E8772E] shadow-sm ring-1 ring-[#E8772E]/20"
                  : "text-[#6B7280] hover:bg-[#FEF3E7]/50 hover:text-[#1A1A1A]",
              )}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div
        className="space-y-6 pt-1"
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        {activeTab === "storefront" && (
      <Card className="border-[var(--primary)]/25 shadow-sm ring-1 ring-[var(--primary)]/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[var(--primary)]" />
            {t("settings.storefrontTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {isSitePublished ? t("settings.storefrontDescPublished") : t("settings.storefrontDescUnpublished")}
          </p>

          {!canSubscribePublish && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/50 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-950 dark:text-amber-100">{t("settings.storefrontUpgradeBanner")}</p>
              <Button variant="primary" className="shrink-0 font-semibold" asChild>
                <a href={effectivePricingUrl} target="_blank" rel="noopener noreferrer">
                  <Crown className="w-4 h-4 mr-2" aria-hidden />
                  {t("settings.plan.viewPricing")}
                </a>
              </Button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="storefront-subdomain">
              {t("settings.subdomainLabel")}
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted-foreground)]">https://</span>
              <input
                id="storefront-subdomain"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={subdomainDraft}
                onChange={(e) => setSubdomainDraft(e.target.value)}
                className="flex-1 min-w-[8rem] rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder={t("settings.subdomainPlaceholder")}
              />
              <span className="text-[var(--muted-foreground)]">.{storefrontRoot}</span>
            </div>
            {!subdomainFormatOk && normalizedSubdomain.length > 0 && (
              <p className="mt-1.5 text-xs text-amber-700">{t("settings.subdomainInvalid")}</p>
            )}
            {subdomainFormatOk && subdomainAvail === "checking" && (
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{t("settings.subdomainChecking")}</p>
            )}
            {subdomainFormatOk && subdomainAvail === "yes" && (
              <p className="mt-1.5 text-xs text-emerald-700">{t("settings.subdomainAvailable")}</p>
            )}
            {subdomainFormatOk && subdomainAvail === "no" && (
              <p className="mt-1.5 text-xs text-red-600">{t("settings.subdomainUnavailable")}</p>
            )}
          </div>

          {isSitePublished ? (
            <>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 space-y-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">{t("settings.publishedUrlTitle")}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium break-all">{publishedStoreUrl}</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyPublishedUrl}>
                    {copiedPublished ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copiedPublished ? t("settings.copied") : t("settings.copy")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={publishedStoreUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
              {normalizedSubdomain !== currentUser.slug && subdomainFormatOk && (
                <p className="text-xs text-amber-700">{t("settings.subdomainSaveHint")}</p>
              )}
              {subdomainSaveError && <p className="text-sm text-red-600">{subdomainSaveError}</p>}
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveSubdomain}
                isLoading={subdomainSaveBusy}
                disabled={
                  !subdomainOkToProceed ||
                  normalizedSubdomain === currentUser.slug
                }
              >
                {t("settings.saveSubdomain")}
              </Button>
            </>
          ) : (
            <>
              {subdomainSaveError && <p className="text-sm text-red-600">{subdomainSaveError}</p>}
              {publishError && <p className="text-sm text-red-600">{publishError}</p>}
              {!subdomainOkToProceed && subdomainFormatOk && (
                <p className="text-xs text-[var(--muted-foreground)]">{t("settings.publishWaitingHint")}</p>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveSubdomain}
                  isLoading={subdomainSaveBusy}
                  disabled={
                    !subdomainOkToProceed ||
                    normalizedSubdomain === currentUser.slug
                  }
                >
                  {t("settings.saveSubdomain")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="font-semibold"
                  onClick={handlePublishSite}
                  isLoading={publishBusy}
                  disabled={!canSubscribePublish || !subdomainOkToProceed}
                  title={
                    !canSubscribePublish
                      ? t("settings.subscribeToPublish")
                      : !subdomainOkToProceed
                        ? t("settings.publishWaitingHint")
                        : undefined
                  }
                >
                  {t("settings.publishSite")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        )}

        {activeTab === "billing" && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-600" />
            {t("settings.plan.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{t("settings.plan.subtitle")}</p>

          <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-violet-50/80 to-transparent dark:from-violet-950/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("settings.plan.current")}
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{planLabel}</p>
            {trialDateStr && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                {t("settings.plan.trial").replace("{date}", trialDateStr)}
              </p>
            )}
          </div>

          {ent && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                {t("settings.plan.usage")}
              </p>
              <ul className="space-y-2 text-sm text-[var(--foreground)]">
                <li className="flex justify-between gap-4">
                  <span className="text-[var(--muted-foreground)]">{t("settings.plan.image3d")}</span>
                  <span className="font-medium tabular-nums">
                    {ent.image3dRemaining} / {ent.image3dMonthlyLimit}
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-[var(--muted-foreground)]">{t("settings.plan.aiChat")}</span>
                  <span className="font-medium tabular-nums text-right">
                    {ent.aiChatMonthlyLimit == null
                      ? t("settings.plan.unlimited")
                      : `${ent.aiChatRemaining ?? 0} / ${ent.aiChatMonthlyLimit}`}
                  </span>
                </li>
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={effectivePricingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                {t("settings.plan.viewPricing")}
              </a>
            </Button>
            {billingPortalUrl && (
              <Button asChild>
                <a href={billingPortalUrl} target="_blank" rel="noopener noreferrer">
                  {t("settings.plan.manageSubscription")}
                </a>
              </Button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-[var(--muted-foreground)] border-t border-[var(--border)] pt-4">
            {t("settings.plan.cancelIntro")}
          </p>
          {supportEmail && (
            <a
              className="inline-flex text-sm font-medium text-[var(--primary)] hover:underline"
              href={`mailto:${supportEmail}`}
            >
              {t("settings.plan.emailSupport")}
            </a>
          )}
        </CardContent>
      </Card>
        )}

        {activeTab === "account" && (
          <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t("settings.language")} & {t("catalog.currency")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("settings.selectLanguage")}
              </label>
              <div className="space-y-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      effectiveLanguage === lang.code
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                    {effectiveLanguage === lang.code && (
                      <Check className="w-4 h-4 text-[var(--primary)] ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("catalog.currency")}
              </label>
              <div className="space-y-2">
                {currencies.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => handleCurrencyChange(curr.code)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      currentUser.currency === curr.code
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    <span className="text-lg font-bold w-6">{curr.symbol}</span>
                    <span className="font-medium">{curr.code}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {curr.name}
                    </span>
                    {currentUser.currency === curr.code && (
                      <Check className="w-4 h-4 text-[var(--primary)] ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Mode */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.currentMode")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {selectedMode && selectedSubModes.length > 0 ? (
                <>
                  <p className="font-medium">
                    {selectedMode.name} → {selectedSubModes.map((sm) => sm.name).join(", ")}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {selectedSubModes.length} {selectedSubModes.length === 1 ? "category" : "categories"} selected
                  </p>
                </>
              ) : (
                <p className="text-[var(--muted-foreground)]">{t("settings.noModeSelected")}</p>
              )}
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/modes">{t("settings.changeMode")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("settings.yourName")}
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label={t("auth.companyName")}
            value={formData.companyName}
            onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
          />
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium leading-none">{t("settings.logo")}</span>
              <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{t("settings.logoHint")}</p>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-20 w-20 rounded-lg border border-[var(--border)] bg-[var(--muted)] shrink-0 flex items-center justify-center overflow-hidden">
                {formData.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded dynamic URL from API
                  <img src={formData.logo} alt="" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-center text-[var(--muted-foreground)] px-1">{t("settings.logoEmpty")}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  aria-label={t("settings.logoUpload")}
                  disabled={logoUploading}
                  onChange={handleLogoFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={logoUploading}
                    onClick={() => logoFileInputRef.current?.click()}
                  >
                    {logoUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("settings.logoUploading")}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {t("settings.logoUpload")}
                      </>
                    )}
                  </Button>
                  {formData.logo ? (
                    <Button type="button" variant="ghost" disabled={logoUploading} onClick={handleLogoRemove}>
                      {t("settings.logoRemove")}
                    </Button>
                  ) : null}
                </div>
                {logoError ? <p className="text-sm text-destructive">{logoError}</p> : null}
              </div>
            </div>
          </div>
          <Button onClick={handleSave} isLoading={isSaving}>
            {saved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t("settings.saved")}
              </>
            ) : (
              t("settings.saveChanges")
            )}
          </Button>
        </CardContent>
      </Card>

      {/* PayPal Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            PayPal Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Enter your PayPal email to accept payments from customers. This email will be used as the PayPal business email for all transactions.
          </p>
          <Input
            label="PayPal Email"
            type="email"
            placeholder="your-paypal@email.com"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
          />
          <Button
            onClick={async () => {
              setPaypalSaving(true);
              await updateUser({ paypalEmail });
              setPaypalSaving(false);
              setPaypalSaved(true);
              setTimeout(() => setPaypalSaved(false), 2000);
            }}
            isLoading={paypalSaving}
          >
            {paypalSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              "Save PayPal Email"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">{t("auth.email")}</span>
              <span>{currentUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">{t("settings.memberSince")}</span>
              <span>
                {new Date(currentUser.createdAt).toLocaleDateString("en-US")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
          </>
        )}

        {activeTab === "appearance" && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {t("settings.publishedSiteDesignTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("settings.publishedSiteDesignDesc")}
            </p>
            {!canUsePublishedLayouts && (
              <p className="mt-2 text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                {t("settings.publishedSiteLayoutUpsell")}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {publicSiteLayouts.map((layout) => {
              const selected = siteLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setSiteLayout(layout.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{layout.name}</span>
                    {selected && <Check className="w-4 h-4 text-[var(--primary)]" />}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {layout.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-5 w-8 rounded-md border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {layout.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t("settings.publishedSiteTextsTitle")}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("settings.publishedSiteTextsHint")}
              </p>
            </div>
            {publicSiteTextFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5 text-[var(--foreground)]">
                  {field.label}
                </label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  value={siteTexts[field.key] || ""}
                  onChange={(e) =>
                    setSiteTexts((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-medium">{t("settings.bespokeDesignTitle")}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {canUseBespokeDesign
                ? currentUser.customDesignKey
                  ? t("settings.bespokeDesignActive").replace("{key}", currentUser.customDesignKey)
                  : t("settings.bespokeDesignEnterpriseHint")
                : t("settings.bespokeDesignUpsell")}
            </p>
          </div>

          <Button onClick={handleSavePublicSite} isLoading={siteSaving}>
            {siteSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t("settings.publishedSiteSaved")}
              </>
            ) : (
              t("settings.savePublishedSite")
            )}
          </Button>
        </CardContent>
      </Card>
        )}

        {activeTab === "planners" && (
          <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {t("settings.plannerMaterials")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{t("settings.plannerMaterialsDesc")}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{t("settings.plannerMaterialsHint")}</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="planner-materials-mode"
                className="mt-1"
                checked={!plannerRestrict}
                onChange={() => setPlannerRestrict(false)}
              />
              <span className="text-sm">{t("settings.plannerMaterialsAll")}</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="planner-materials-mode"
                className="mt-1"
                checked={plannerRestrict}
                onChange={() => {
                  setPlannerRestrict(true);
                  setPlannerSelection((prev) => {
                    if (prev.size > 0) return prev;
                    return new Set(sortedMaterials.map((m) => m.id));
                  });
                }}
              />
              <span className="text-sm">{t("settings.plannerMaterialsPick")}</span>
            </label>
          </div>
          {plannerRestrict && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] p-2 space-y-0.5">
              {sortedMaterials.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] px-2 py-3">
                  {t("settings.plannerMaterialsEmpty")}
                </p>
              ) : (
                sortedMaterials.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-[var(--muted)]/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={plannerSelection.has(m.id)}
                      onChange={(e) => {
                        setPlannerSelection((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        });
                      }}
                    />
                    <span>{m.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
          <Button
            variant="outline"
            disabled={plannerRestrict && plannerSelection.size === 0 && sortedMaterials.length > 0}
            isLoading={plannerSaving}
            onClick={async () => {
              setPlannerSaving(true);
              try {
                await updateUser({
                  plannerMaterialIds:
                    plannerRestrict && plannerSelection.size > 0 ? Array.from(plannerSelection) : null,
                });
                setPlannerSaved(true);
                setTimeout(() => setPlannerSaved(false), 2000);
              } finally {
                setPlannerSaving(false);
              }
            }}
          >
            {plannerSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t("settings.plannerMaterialsSaved")}
              </>
            ) : (
              t("settings.savePlannerMaterials")
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            {t("settings.plannerFurniture")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{t("settings.plannerFurnitureDesc")}</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="planner-catalog-mode"
                className="mt-1"
                checked={!customCatalogOnly}
                onChange={() => setCustomCatalogOnly(false)}
              />
              <span className="text-sm">{t("settings.plannerFurnitureDefault")}</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="planner-catalog-mode"
                className="mt-1"
                checked={customCatalogOnly}
                onChange={() => setCustomCatalogOnly(true)}
              />
              <span className="text-sm">{t("settings.plannerFurnitureCustom")}</span>
            </label>
          </div>
          <Button
            variant="outline"
            isLoading={catalogModeSaving}
            onClick={async () => {
              setCatalogModeSaving(true);
              try {
                await updateUser({ useCustomPlannerCatalog: customCatalogOnly });
                setCatalogModeSaved(true);
                setTimeout(() => setCatalogModeSaved(false), 2000);
              } finally {
                setCatalogModeSaving(false);
              }
            }}
          >
            {catalogModeSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t("settings.plannerFurnitureSaved")}
              </>
            ) : (
              t("settings.savePlannerFurniture")
            )}
          </Button>
        </CardContent>
      </Card>
          </>
        )}
      </div>
    </div>
  );
}
