"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Button, Card, CardContent } from "@/components/ui";
import { ModeIcon } from "@/components/icons/ModeIcons";
import { ArrowRight } from "lucide-react";

export default function ModesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { modes, fetchModes } = useStore();
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setLoadState("loading");
    fetchModes()
      .then(() => setLoadState("ok"))
      .catch(() => setLoadState("error"));
  }, []);

  const getModeTranslation = (slug: string) => {
    const translations: Record<string, { name: string; desc: string }> = {
      furniture: { name: t("modes.furniture"), desc: t("modes.furnitureDesc") },
      "soft-furniture": { name: t("modes.softFurniture"), desc: t("modes.softFurnitureDesc") },
      "doors-windows": { name: t("modes.doorsWindows"), desc: t("modes.doorsWindowsDesc") },
    };
    return translations[slug] || { name: slug, desc: "" };
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("modes.selectMode")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("modes.chooseType")}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loadState === "ok" && modes.map((mode) => {
            const modeText = getModeTranslation(mode.slug);
            return (
              <Card
                key={mode.id}
                className="cursor-pointer hover:border-[var(--primary)] hover:shadow-lg transition-all group"
                onClick={() => router.push(`/admin/modes/${mode.slug}`)}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--primary)]/10 flex items-center justify-center group-hover:bg-[var(--primary)]/20 transition-colors">
                    <ModeIcon name={mode.icon} className="w-8 h-8 text-[var(--primary)]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{modeText.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    {modeText.desc}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--primary)]">
                    <span>
                      {(mode.subModes?.length ?? 0)} {t("modes.subCategories")}
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

