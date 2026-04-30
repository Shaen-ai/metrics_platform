"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  Store,
  CreditCard,
  UserRound,
  Palette,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui";
import { ModeIcon } from "@/components/icons/ModeIcons";
import { getPricingPageUrl } from "@/lib/billingLinks";
import { getLandingUrl } from "@/lib/landingUrl";
import { LanguagePreferenceButton } from "@/components/LanguagePreferenceButton";

function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { currentUser, isAuthenticated, logout, modes, fetchModes, updateUser, restoreSession } = useStore();
  const hydrated = useHydration();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isModeSelection = pathname?.startsWith("/admin/modes");

  useEffect(() => {
    if (!hydrated) return;
    void restoreSession();
  }, [hydrated, restoreSession]);

  useEffect(() => {
    if (isAuthenticated) fetchModes().catch(() => {});
  }, [isAuthenticated, fetchModes]);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!isModeSelection && (!currentUser?.selectedModeId || !currentUser?.selectedSubModeIds?.length)) {
      router.push("/admin/modes");
      return;
    }
  }, [hydrated, isAuthenticated, currentUser?.selectedModeId, currentUser?.selectedSubModeIds, isModeSelection, router]);

  if (!hydrated) {
    return <AdminLoading />;
  }

  if (
    !isAuthenticated ||
    (!isModeSelection && (!currentUser?.selectedModeId || !currentUser?.selectedSubModeIds?.length))
  ) {
    return <AdminLoading />;
  }

  if (isModeSelection) {
    return <>{children}</>;
  }

  if (!currentUser?.selectedModeId || !currentUser?.selectedSubModeIds?.length) {
    return <AdminLoading />;
  }

  const selectedSubModeIdSet = new Set(currentUser.selectedSubModeIds);
  const selectedModes = modes.filter((mode) =>
    mode.subModes.some((subMode) => selectedSubModeIdSet.has(subMode.id)),
  );
  const selectedModeLabel = selectedModes.length
    ? selectedModes.map((mode) => mode.name).join(", ")
    : currentUser.companyName;

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

  const isSettingsActive = pathname?.startsWith("/admin/settings") === true;
  const activeSettingsTab = isSettingsActive ? searchParams.get("tab") ?? "storefront" : null;
  const settingsNavItems = [
    { tab: "storefront", icon: Store, label: t("settings.tabs.storefront") },
    { tab: "billing", icon: CreditCard, label: t("settings.tabs.billing") },
    { tab: "account", icon: UserRound, label: t("settings.tabs.account") },
    { tab: "appearance", icon: Palette, label: t("settings.tabs.appearance") },
    { tab: "planners", icon: Layers, label: t("settings.tabs.planners") },
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
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-white border-r border-[#F0E6D8] transform transition-transform lg:translate-x-0 ${
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
            {selectedModes[0] && <ModeIcon name={selectedModes[0].icon} className="w-4 h-4 text-[#E8772E]" />}
            <span className="text-sm font-medium text-[#1A1A1A]">{selectedModeLabel}</span>
            <ChevronDown className="w-4 h-4 ml-auto text-[#6B7280]" />
          </div>
          <p className="text-xs text-[#E8772E] mt-1">{t("modes.clickToChange")}</p>
        </Link>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin/settings"
                ? isSettingsActive
                : pathname === item.href;
            return (
              <div key={item.href}>
                <Link
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

                {item.href === "/admin/settings" && isSettingsActive && (
                  <div className="mt-1 ml-8 space-y-0.5 border-l border-[#F0E6D8] pl-2">
                    {settingsNavItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeSettingsTab === subItem.tab;
                      return (
                        <Link
                          key={subItem.tab}
                          href={`/admin/settings?tab=${subItem.tab}`}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isSubActive
                              ? "bg-[#FEF3E7] text-[#E8772E] font-medium"
                              : "text-[#6B7280] hover:bg-[#FEF3E7]/60 hover:text-[#E8772E]"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 shrink-0" />
                          <span>{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Upgrade CTA (above language — higher priority for revenue) */}
        <div className="shrink-0 space-y-2 border-t border-[#F0E6D8] bg-white p-4">
          {showSidebarUpgrade && (
            <Button variant="primary" className="w-full font-semibold shadow-sm ring-1 ring-[#E8772E]/30" asChild>
              <a href={upgradePricingUrl} target="_blank" rel="noopener noreferrer">
                <Crown className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                {t("nav.upgradePlan")}
              </a>
            </Button>
          )}
          <LanguagePreferenceButton
            fallback={currentUser?.language}
            onChange={(lang) => updateUser({ language: lang } as Partial<import("@/lib/types").User>)}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-[#6B7280] hover:bg-[#FEF3E7]/60 hover:text-[#E8772E] transition-colors"
          />
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
