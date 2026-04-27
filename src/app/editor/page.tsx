"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import AI Chat component with proper loading state
const AIChatComponent = dynamic(() => import("@/components/editor/AIChat"), {
  ssr: false,
  loading: () => <div>Loading AI Chat...</div>,
});

export default function EditorPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <AIChatComponent />
      </Suspense>
    </div>
  );
}
