"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Box, Loader2 } from "lucide-react";
import { toRelativeStorageUrl } from "@/lib/utils";

export default function ModelViewerCard({
  src,
  alt,
  fallbackImage,
}: {
  src: string;
  alt: string;
  fallbackImage?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  const resolvedSrc = toRelativeStorageUrl(src);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container || !resolvedSrc) return;

    import("@google/model-viewer")
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const mv = document.createElement("model-viewer") as HTMLElement;
        mv.setAttribute("src", resolvedSrc);
        mv.setAttribute("alt", alt);
        mv.setAttribute("camera-controls", "");
        mv.setAttribute("auto-rotate", "");
        /** Default in model-viewer is 105% distance / 30° FOV — tight for list tiles; pull back and widen. */
        mv.setAttribute("camera-orbit", "0deg 70deg 152%");
        mv.setAttribute("field-of-view", "42deg");
        mv.setAttribute("min-field-of-view", "18deg");
        mv.setAttribute("max-field-of-view", "55deg");
        /** Keep a margin when orbit/zooming so the mesh stays inside the frame. */
        mv.setAttribute("min-camera-orbit", "0deg 22.5deg 112%");
        mv.setAttribute("max-camera-orbit", "180deg 90deg 400%");
        mv.setAttribute("shadow-intensity", "0.5");
        mv.setAttribute("exposure", "1");
        mv.style.width = "100%";
        mv.style.height = "100%";
        mv.style.display = "block";
        mv.style.minHeight = "160px";

        mv.addEventListener("error", () => {
          if (!cancelled) setStatus("failed");
        });

        containerRef.current.appendChild(mv);
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [resolvedSrc, alt]);

  if (status === "failed") {
    if (fallbackImage) {
      return (
        <Image
          src={fallbackImage}
          alt={alt}
          fill
          className="object-cover"
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Box className="w-12 h-12 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600">3D Model</span>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden"
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {status === "loading" && (
        <div className="flex items-center justify-center absolute inset-0">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      )}
    </div>
  );
}
