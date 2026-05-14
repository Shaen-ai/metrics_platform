"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api";

interface ErrorReportDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
}

export function ErrorReportDialog({ open, onClose, error }: ErrorReportDialogProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setReportStatus("idle");
      hasSentRef.current = false;
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
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

  const sendReport = useCallback(async () => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;
    setReportStatus("sending");

    let screenshot: string | null = null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 0.5,
      });
      screenshot = canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      // screenshot failed silently — proceed without it
    }

    try {
      await api.sendErrorReport({
        message: error,
        screenshot,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      setReportStatus("sent");
    } catch {
      setReportStatus("failed");
    }
  }, [error]);

  // Auto-send in background as soon as dialog opens
  useEffect(() => {
    if (open && reportStatus === "idle") {
      sendReport();
    }
  }, [open, reportStatus, sendReport]);

  if (!visible) return null;

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
          "relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[var(--border)] transition-all duration-200",
          animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="pt-1">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Something went wrong</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                An unexpected error occurred. Please try again.
              </p>
            </div>
          </div>

          {/* Error message box */}
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
            <p className="text-sm text-red-800 font-mono leading-relaxed break-words">{error}</p>
          </div>

          {/* Report status */}
          <div className="flex items-center gap-2 mb-5 min-h-[20px]">
            {reportStatus === "sending" && (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--muted-foreground)]">Sending report to support…</span>
              </>
            )}
            {reportStatus === "sent" && (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-700">Report sent to support@tunzone.com</span>
              </>
            )}
            {reportStatus === "failed" && (
              <button
                type="button"
                onClick={sendReport}
                className="flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline"
              >
                <Send className="w-3 h-3" />
                Retry sending to support
              </button>
            )}
          </div>

          <Button type="button" className="w-full" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
