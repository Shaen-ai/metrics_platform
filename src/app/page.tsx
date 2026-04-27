"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, useHydration } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, currentUser, restoreSession } = useStore();
  const hydrated = useHydration();

  useEffect(() => { restoreSession(); }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated) {
      router.push("/login");
    } else if (currentUser?.selectedModeId && currentUser?.selectedSubModeIds?.length) {
      router.push("/admin");
    } else {
      router.push("/admin/modes");
    }
  }, [hydrated, isAuthenticated, currentUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
    </div>
  );
}
