"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useStore, useHydration } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Box,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Globe,
  Crown,
} from "lucide-react";
import { languages, normalizeLanguageCode } from "@/lib/translations";
import { Button } from "@/components/ui";
import { ModeIcon } from "@/components/icons/ModeIcons";
import { getPricingPageUrl } from "@/lib/billingLinks";
import { getLandingUrl } from "@/lib/landingUrl";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { currentUser, isAuthenticated, logout, getModeById, getSubModesByIds, fetchModes, updateUser, restoreSession } = useStore();
  const hydrated = useHydration();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    void restoreSession();
  }, [hydrated, restoreSession]);

  useEffect(() => {
    if (isAuthenticated) fetchModes().catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!hydrated) return;

    const isModeSelection = pathname?.startsWith("/admin/modes");

    if (!isAuthenticated) {
      setIsRedirecting(true);
      router.push("/login");
      return;
    }

    if (!isModeSelection && (!currentUser?.selectedModeId || !currentUser?.selectedSubModeIds?.length)) {
      setIsRedirecting(true);
      router.push("/admin/modes");
      return;
    }

    setIsRedirecting(false);
  }, [hydrated, isAuthenticated, currentUser?.selectedModeId, currentUser?.selectedSubModeIds, pathname, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (isRedirecting || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  const isModeSelection = pathname?.startsWith("/admin/modes");

  if (isModeSelection) {
    return <>{children}</>;
  }

  if (!currentUser?.selectedModeId || !currentUser?.selectedSubModeIds?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  const selectedMode = getModeById(currentUser.selectedModeId);
  const selectedSubModes = getSubModesByIds(currentUser.selectedModeId, currentUser.selectedSubModeIds);

  const planTier =
    currentUser.entitlements?.planTier ?? currentUser.planTier ?? "free";
  const showSidebarUpgrade =
    planTier !== "business_pro" && planTier !== "enterprise";
  const upgradePricingUrl = (getPricingPageUrl() || `${getLandingUrl()}/pricing`).trim();

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/admin/catalog", icon: Package, label: t("nav.catalog") },
    { href: "/admin/materials", icon: Layers, label: t("nav.materials") },
    { href: "/admin/modules", icon: Box, label: t("nav.modules") },
    { href: "/admin/orders", icon: ShoppingCart, label: t("nav.orders") },
    { href: "/admin/settings", icon: Settings, label: t("nav.settings") },
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#F0E6D8] z-40 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6 text-[#1A1A1A]" />
        </button>
        <span className="font-semibold text-[#1A1A1A]">{currentUser?.companyName}</span>
        <div className="w-10" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-[#F0E6D8] z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-[#F0E6D8] flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-[#1A1A1A]">{currentUser?.companyName}</h1>
            <p className="text-xs text-[#6B7280]">{currentUser?.email}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
            <X className="w-5 h-5 text-[#1A1A1A]" />
          </button>
        </div>

        {/* Current Mode Display */}
        <Link
          href="/admin/modes"
          className="block m-4 p-3 bg-[#FEF3E7] rounded-xl hover:bg-[#FEF3E7]/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            {selectedMode && <ModeIcon name={selectedMode.icon} className="w-4 h-4 text-[#E8772E]" />}
            <span className="text-sm font-medium text-[#1A1A1A]">{selectedMode?.name}</span>
            <ChevronDown className="w-4 h-4 ml-auto text-[#6B7280]" />
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            {selectedSubModes.map((sm) => sm.name).join(", ")}
          </p>
          <p className="text-xs text-[#E8772E] mt-1">{t("modes.clickToChange")}</p>
        </Link>

        {/* Navigation */}
        <nav className={`p-4 space-y-1 ${showSidebarUpgrade ? "pb-44" : "pb-36"}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  isActive
                    ? "bg-[#FEF3E7] text-[#E8772E] font-medium"
                    : "text-[#6B7280] hover:bg-[#FEF3E7]/60 hover:text-[#E8772E]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Upgrade CTA (above language — higher priority for revenue) */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {showSidebarUpgrade && (
            <Button variant="primary" className="w-full font-semibold shadow-sm ring-1 ring-[#E8772E]/30" asChild>
              <a href={upgradePricingUrl} target="_blank" rel="noopener noreferrer">
                <Crown className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                {t("nav.upgradePlan")}
              </a>
            </Button>
          )}
          <button
            onClick={() => {
              const currentLang = normalizeLanguageCode(currentUser?.language);
              const currentIdx = languages.findIndex((l) => l.code === currentLang);
              const nextLang = languages[(currentIdx + 1) % languages.length];
              updateUser({ language: nextLang.code } as Partial<import("@/lib/types").User>);
            }}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-[#6B7280] hover:bg-[#FEF3E7]/60 hover:text-[#E8772E] transition-colors"
          >
            <Globe className="w-5 h-5" />
            <span>
              {languages.find((l) => l.code === normalizeLanguageCode(currentUser?.language))?.flag}{" "}
              {languages.find((l) => l.code === normalizeLanguageCode(currentUser?.language))?.name}
            </span>
          </button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            {t("auth.logout")}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
