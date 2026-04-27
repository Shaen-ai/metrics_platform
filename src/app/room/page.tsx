"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Maximize2,
  Sun,
  Moon,
  Eye,
  ChevronDown,
  Home,
} from "lucide-react";

const RoomScene = dynamic(() => import("@/components/room/RoomScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70 text-sm">Loading 3D Room...</p>
      </div>
    </div>
  ),
});

export default function RoomViewerPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a]">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-[#0f0f1a]/90 backdrop-blur-md border-b border-white/10 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-white/80" />
              <h1 className="text-white font-medium">Room Visualizer</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 3D Scene */}
      <main className="flex-1 relative">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
              <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          }
        >
          <RoomScene />
        </Suspense>

        {/* Controls hint overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white/50 text-xs">
          <span>Left click + drag to rotate</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span>Scroll to zoom</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span>Right click + drag to pan</span>
        </div>

        {/* Room info */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-xl px-4 py-3 text-white/70 text-xs space-y-1">
          <p className="text-white/90 font-medium text-sm mb-2">Living Room</p>
          <p>6m × 5m × 2.8m</p>
          <p>Hardwood floor</p>
          <p>9 furniture items</p>
        </div>
      </main>
    </div>
  );
}
