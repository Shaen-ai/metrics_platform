"use client";

import { useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
}: ConfirmDialogProps) {
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
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
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
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
    info: "bg-blue-100 text-blue-600",
  };

  const buttonVariants = {
    danger: "destructive" as const,
    warning: "primary" as const,
    info: "primary" as const,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={onCancel}
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
          onClick={onCancel}
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
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {title}
          </h3>

          {message && (
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
              {message}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              variant={buttonVariants[variant]}
              className="flex-1"
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
