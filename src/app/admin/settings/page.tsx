"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui";
import { Copy, Check, ExternalLink, Globe, CreditCard, Layers, LayoutGrid, Crown, Palette } from "lucide-react";
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

export default function SettingsPage() {
  const { t } = useTranslation();
  const {
    currentUser,
    updateUser,
    refreshProfile,
    getModeById,
    getSubModesByIds,
    fetchMaterials,
    materials,
  } = useStore();
  const [copied, setCopied] = useState(false);
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

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    fetchMaterials().catch(() => {});
  }, [fetchMaterials]);

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

  if (!currentUser) return null;

  const ent = currentUser.entitlements;
  const planTier = ent?.planTier ?? currentUser.planTier ?? "free";
  const planTierKey = `settings.plan.tier.${planTier}` as const;
  let planLabel = t(planTierKey);
  if (planLabel === planTierKey) {
    planLabel = planTier ? `${t("settings.plan.unknown")} (${planTier})` : t("settings.plan.tier.free");
  }
  const pricingUrl = getPricingPageUrl();
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

  const publicUrl = `${origin}/${currentUser.slug}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateUser(formData);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-[var(--muted-foreground)]">
          {t("settings.description")}
        </p>
      </div>

      {/* Plan & billing */}
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
            {pricingUrl && (
              <Button variant="outline" asChild>
                <a href={pricingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  {t("settings.plan.viewPricing")}
                </a>
              </Button>
            )}
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

      {/* Language & Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t("settings.language")} & {t("catalog.currency")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
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

      {/* Public Page URL */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.publicPage")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            {t("settings.publicPageDesc")}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center px-3 bg-[var(--muted)] rounded-lg text-sm">
              <span className="truncate">{publicUrl}</span>
            </div>
            <Button variant="outline" onClick={handleCopyUrl}>
              {copied ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? t("settings.copied") : t("settings.copy")}
            </Button>
            <Button variant="outline" asChild>
              <a href={`/${currentUser.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Published Site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Published Site
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Customize the text and design customers see on your Tunzone published site.
            </p>
            {!canUsePublishedLayouts && (
              <p className="mt-2 text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Layout selection is available on Business Pro and Enterprise. You can preview designs, but the default layout will remain active.
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
              <h3 className="text-sm font-semibold">Published site texts</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Leave a field empty to use the Tunzone default copy.
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
            <p className="text-sm font-medium">Bespoke paid design</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {canUseBespokeDesign
                ? currentUser.customDesignKey
                  ? `Custom design active: ${currentUser.customDesignKey}`
                  : "Enterprise accounts can have a fully custom design assigned by Tunzone."
                : "Fully custom user-specific designs are available for Enterprise customers after Tunzone assigns a bespoke design."}
            </p>
          </div>

          <Button onClick={handleSavePublicSite} isLoading={siteSaving}>
            {siteSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Published site saved
              </>
            ) : (
              "Save published site"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Planner materials (public site) */}
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

      {/* Public planner furniture catalog */}
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
          <Input
            label={t("settings.logoUrl")}
            placeholder="https://example.com/logo.png"
            value={formData.logo}
            onChange={(e) => setFormData((p) => ({ ...p, logo: e.target.value }))}
          />
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
              <span className="text-[var(--muted-foreground)]">{t("settings.slug")}</span>
              <span>{currentUser.slug}</span>
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
    </div>
  );
}
