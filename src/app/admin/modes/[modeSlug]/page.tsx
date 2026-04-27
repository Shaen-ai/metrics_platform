"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, Button } from "@/components/ui";
import { ModeIcon } from "@/components/icons/ModeIcons";
import { ArrowLeft, Check } from "lucide-react";

export default function SubModesPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { modes, currentUser, selectMode, fetchModes } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchModes().catch(() => {}); }, []);

  const modeSlug = params.modeSlug as string;
  const currentMode = modes.find((m) => m.slug === modeSlug);

  useEffect(() => {
    if (currentUser?.selectedSubModeIds && currentMode) {
      const modeSubIds = new Set(currentMode.subModes.map((sm) => sm.id));
      const existing = currentUser.selectedSubModeIds.filter((id) => modeSubIds.has(id));
      setSelectedIds(new Set(existing));
    }
  }, [currentUser?.selectedSubModeIds, currentMode]);

  if (!currentMode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  /** Sub-mode slug → i18n key. Unlisted slugs use `subMode.name` from the API (readable fallback). */
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
    "interior-doors": "submodes.interiorDoors",
    "exterior-doors": "submodes.exteriorDoors",
    windows: "submodes.windows",
    partitions: "submodes.partitions",
  };

  const getSubModeTitle = (subMode: { slug: string; name: string }) => {
    const key = subModeSlugToI18nKey[subMode.slug];
    return key ? t(key) : subMode.name;
  };

  const getModeTranslation = (slug: string) => {
    const translations: Record<string, string> = {
      furniture: t("modes.furniture"),
      "soft-furniture": t("modes.softFurniture"),
      "doors-windows": t("modes.doorsWindows"),
    };
    return translations[slug] || slug;
  };

  const toggleSubMode = (subModeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subModeId)) {
        next.delete(subModeId);
      } else {
        next.add(subModeId);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    await selectMode(currentMode.id, Array.from(selectedIds));
    router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.push("/admin/modes")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("modes.backToModes")}
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
            <ModeIcon name={currentMode.icon} className="w-8 h-8 text-[var(--primary)]" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{getModeTranslation(currentMode.slug)}</h1>
          <p className="text-[var(--muted-foreground)]">{t("modes.chooseCategory")}</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Select one or more categories, then press Continue
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {currentMode.subModes.map((subMode) => {
            const isSelected = selectedIds.has(subMode.id);
            return (
              <Card
                key={subMode.id}
                className={`cursor-pointer transition-all group ${
                  isSelected
                    ? "border-[var(--primary)] shadow-lg ring-2 ring-[var(--primary)]/20"
                    : "hover:border-[var(--primary)] hover:shadow-lg"
                }`}
                onClick={() => toggleSubMode(subMode.id)}
              >
                <CardContent className="p-6 text-center relative">
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center transition-colors ${
                    isSelected ? "bg-[var(--primary)]/10" : "bg-[var(--muted)] group-hover:bg-[var(--primary)]/10"
                  }`}>
                    <ModeIcon
                      name={subMode.icon}
                      className={`w-6 h-6 transition-colors ${
                        isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                      }`}
                    />
                  </div>
                  <h3 className="font-semibold mb-1">{getSubModeTitle(subMode)}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {subMode.description}
                  </p>
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
            Continue with {selectedIds.size} {selectedIds.size === 1 ? "category" : "categories"}
          </Button>
        </div>
      </div>
    </div>
  );
}
