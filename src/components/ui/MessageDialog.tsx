"use client";

import { useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { AlertTriangle, Info, X } from "lucide-react";

interface MessageDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  /** @default "OK" */
  confirmText?: string;
  actionHref?: string;
  actionText?: string;
  variant?: "warning" | "info";
}

export function MessageDialog({
  open,
  onClose,
  title,
  message,
  confirmText = "OK",
  actionHref,
  actionText,
  variant = "warning",
}: MessageDialogProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleKeyDown]);

  if (!visible) return null;

  const iconColors = {
    warning: "bg-amber-100 text-amber-600",
    info: "bg-blue-100 text-blue-600",
  };
  const Icon = variant === "info" ? Info : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-[var(--border)] transition-all duration-200",
          animating
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2"
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 text-center">
          <div
            className={cn(
              "mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4",
              iconColors[variant]
            )}
          >
            <Icon className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {title}
          </h3>

          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6 text-left">
            {message}
          </p>

          <div className="space-y-2">
            {actionHref && actionText && (
              <Button type="button" variant="primary" className="w-full" asChild>
                <a href={actionHref} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                  {actionText}
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant={actionHref ? "outline" : "primary"}
              className="w-full"
              onClick={onClose}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
