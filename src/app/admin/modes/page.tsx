"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Button, Card, CardContent } from "@/components/ui";
import { ModeIcon } from "@/components/icons/ModeIcons";
import { LanguagePreferenceButton } from "@/components/LanguagePreferenceButton";
import { Check } from "lucide-react";

export default function ModesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { modes, currentUser, fetchModes, selectMode, updateUser } = useStore();
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLoadState("loading");
    fetchModes()
      .then(() => setLoadState("ok"))
      .catch(() => setLoadState("error"));
  }, [fetchModes]);

  useEffect(() => {
    if (!modes.length) return;

    const availableIds = new Set(
      modes.flatMap((mode) => mode.subModes.map((subMode) => subMode.id)),
    );
    const existing =
      currentUser?.selectedSubModeIds?.filter((id) => availableIds.has(id)) ?? [];
    setSelectedIds(new Set(existing));
  }, [currentUser?.selectedSubModeIds, modes]);

  const getModeTranslation = (slug: string) => {
    const translations: Record<string, { name: string; desc: string }> = {
      furniture: { name: t("modes.furniture"), desc: t("modes.furnitureDesc") },
      "soft-furniture": { name: t("modes.softFurniture"), desc: t("modes.softFurnitureDesc") },
    };
    return translations[slug] || { name: slug, desc: "" };
  };

  /** Sub-mode slug -> i18n key. Unlisted slugs use `subMode.name` from the API. */
  const subModeSlugToI18nKey: Record<string, string> = {
    kitchen: "submodes.kitchen",
    "living-room": "submodes.livingRoom",
    bedroom: "submodes.bedroom",
    office: "submodes.office",
    bathroom: "submodes.bathroom",
    outdoor: "submodes.outdoor",
    sofas: "submodes.sofas",
    chairs: "submodes.chairs",
    beds: "submodes.beds",
    poufs: "submodes.poufs",
    "sofas-sectionals": "submodes.sofasSectionals",
    "armchairs-recliners": "submodes.armchairsRecliners",
    "ottomans-poufs": "submodes.ottomansPoufs",
    mattresses: "submodes.mattresses",
    headboards: "submodes.headboards",
  };

  const getSubModeTitle = (subMode: { slug: string; name: string }) => {
    const key = subModeSlugToI18nKey[subMode.slug];
    return key ? t(key) : subMode.name;
  };

  const toggleMode = (subModeIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = subModeIds.every((id) => next.has(id));
      subModeIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const toggleSubMode = (subModeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subModeId)) next.delete(subModeId);
      else next.add(subModeId);
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedIds.size === 0) return;

    const selectedIdList = Array.from(selectedIds);
    const primaryMode =
      modes.find((mode) => mode.subModes.some((subMode) => selectedIds.has(subMode.id))) ??
      modes[0];

    if (!primaryMode) return;

    setIsSaving(true);
    try {
      await selectMode(primaryMode.id, selectedIdList);
      router.push("/admin");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative">
      <LanguagePreferenceButton
        fallback={currentUser?.language}
        onChange={(lang) => void updateUser({ language: lang })}
        className="absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
      />
      <div className="max-w-5xl w-full">
        <div className="text-center mb-8 space-y-4">
          <h1 className="text-3xl font-bold mb-2">{t("modes.selectMode")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("modes.chooseType")}</p>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl mx-auto leading-relaxed rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-left">
            {t("modes.catalogVsPlannersShort")}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">{t("modes.pickCategoriesHint")}</p>
        </div>

        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
          </div>
        )}

        {loadState === "error" && (
          <div className="text-center py-8 space-y-4">
            <p className="text-[var(--muted-foreground)]">{t("modes.loadFailed")}</p>
            <Button
              type="button"
              onClick={() => {
                setLoadState("loading");
                fetchModes()
                  .then(() => setLoadState("ok"))
                  .catch(() => setLoadState("error"));
              }}
            >
              {t("modes.retry")}
            </Button>
          </div>
        )}

        {loadState === "ok" && modes.length === 0 && (
          <p className="text-center text-[var(--muted-foreground)] py-8">{t("modes.noneAvailable")}</p>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {loadState === "ok" && modes.map((mode) => {
            const modeText = getModeTranslation(mode.slug);
            const subModeIds = mode.subModes.map((sm) => sm.id);
            const selectedInMode = subModeIds.filter((id) => selectedIds.has(id)).length;
            const allSelected = subModeIds.length > 0 && selectedInMode === subModeIds.length;
            return (
              <Card
                key={mode.id}
                className={`transition-all ${
                  selectedInMode > 0
                    ? "border-[var(--primary)] shadow-lg ring-2 ring-[var(--primary)]/10"
                    : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                      <ModeIcon name={mode.icon} className="w-7 h-7 text-[var(--primary)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold">{modeText.name}</h3>
                      <p className="text-sm text-[var(--muted-foreground)] mt-1">{modeText.desc}</p>
                      <p className="text-xs text-[var(--primary)] mt-2">
                        {t("modes.selectedInCategory")
                          .replace("{selected}", String(selectedInMode))
                          .replace("{total}", String(subModeIds.length))}
                      </p>
                    </div>
                    {selectedInMode > 0 && (
                      <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant={allSelected ? "outline" : "primary"}
                      size="sm"
                      onClick={() => toggleMode(subModeIds)}
                    >
                      {allSelected ? t("modes.clearCategory") : t("modes.selectAllInCategory")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/admin/modes/${mode.slug}`)}
                    >
                      {t("modes.goDeeper")}
                    </Button>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {mode.subModes.map((subMode) => {
                      const isSelected = selectedIds.has(subMode.id);
                      return (
                        <button
                          key={subMode.id}
                          type="button"
                          onClick={() => toggleSubMode(subMode.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? "border-[var(--primary)] bg-[var(--primary)]/5"
                              : "border-[var(--border)] hover:border-[var(--primary)]/50"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
                            <ModeIcon
                              name={subMode.icon}
                              className={`w-3.5 h-3.5 ${
                                isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                              }`}
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{getSubModeTitle(subMode)}</span>
                          {isSelected && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={selectedIds.size === 0 || isSaving}
            isLoading={isSaving}
            className="px-8"
          >
            {t("modes.continueWithCategories").replace("{count}", String(selectedIds.size))}
          </Button>
        </div>
      </div>
    </div>
  );
}

