"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type CSSProperties,
} from "react";
import { Button, MessageDialog } from "@/components/ui";
import {
  Image3dUpgradeModal,
  getImage3dBlockReason,
  getImage3dErrorReason,
  type Image3dBlockReason,
} from "@/components/Image3dUpgradeModal";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { toRelativeStorageUrl } from "@/lib/utils";
import {
  getFirstOversizeFile,
  isFileOverMaxUpload,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  RotateCcw,
  Box,
} from "lucide-react";

export type Model3DGeneratorHandle = {
  /** If the user has selected reference images, starts Meshy; otherwise no-op. */
  runPendingGeneration: () => Promise<string | null>;
};

interface Model3DGeneratorProps {
  entityId: string;
  entityType?: "catalog" | "module";
  currentModelUrl?: string;
  currentStatus?: string;
  currentJobId?: string;
  onModelReady: (modelUrl: string) => void;
  onModelQueued?: (jobId: string) => void | Promise<void>;
}

type GenerationStatus = "idle" | "uploading" | "queued" | "processing" | "done" | "failed";

const generationSteps = [
  "Images selected",
  "Uploading",
  "Queued",
  "Generating",
  "Ready",
] as const;

const modelViewerPreviewStyle = {
  width: "100%",
  height: "100%",
  minHeight: 160,
  "--progress-bar-height": "0px",
} as CSSProperties;

function stepIndexForStatus(status: GenerationStatus, hasPendingImages: boolean): number {
  if (status === "done") return 4;
  if (status === "processing") return 3;
  if (status === "queued") return 2;
  if (status === "uploading") return 1;
  if (hasPendingImages) return 0;
  return -1;
}

function GenerationStepper({
  status,
  hasPendingImages,
}: {
  status: GenerationStatus;
  hasPendingImages: boolean;
}) {
  const activeIndex = stepIndexForStatus(status, hasPendingImages);
  if (activeIndex < 0 && status !== "failed") return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--foreground)]">
          Image-to-3D progress
        </p>
        <p className="text-[11px] text-[var(--muted-foreground)]">
          {status === "failed" ? "Needs attention" : generationSteps[Math.max(activeIndex, 0)]}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {generationSteps.map((label, index) => {
          const complete = status === "done" || (activeIndex > index && status !== "failed");
          const current = activeIndex === index && status !== "failed";
          return (
            <div key={label} className="min-w-0">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  complete
                    ? "bg-emerald-500"
                    : current
                      ? "bg-blue-500"
                      : "bg-[var(--border)]"
                }`}
              />
              <p
                className={`mt-1 truncate text-[10px] ${
                  complete || current
                    ? "font-medium text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]"
                }`}
                title={label}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const Model3DGenerator = forwardRef<Model3DGeneratorHandle | null, Model3DGeneratorProps>(
  function Model3DGenerator(
    {
  entityId,
  entityType = "catalog",
  currentModelUrl,
  currentStatus,
  currentJobId,
  onModelReady,
  onModelQueued,
    },
    ref
  ) {
  const { t } = useTranslation();
  const refreshProfile = useStore((s) => s.refreshProfile);
  const image3dEntitlements = useStore((s) => s.currentUser?.entitlements);
  const image3dBlockReason = getImage3dBlockReason(image3dEntitlements);
  const image3dBlocked = image3dBlockReason !== null;
  const [status, setStatus] = useState<GenerationStatus>(
    currentModelUrl
      ? "done"
      : (currentStatus as GenerationStatus) || "idle"
  );
  const [jobId, setJobId] = useState<string | null>(currentJobId || null);
  const [error, setError] = useState<string | undefined>();
  const [modelUrl, setModelUrl] = useState<string | undefined>(
    currentModelUrl ? toRelativeStorageUrl(currentModelUrl) : undefined
  );
  const [dragOver, setDragOver] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] =
    useState<Image3dBlockReason>("limit");
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);

  const imgRef = useRef<HTMLInputElement>(null);
  const glbRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meshyInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (!modelViewerLoaded) {
      import("@google/model-viewer").then(() => setModelViewerLoaded(true));
    }
  }, [modelViewerLoaded]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if ((status !== "queued" && status !== "processing") || !jobId) {
      stopPolling();
      return;
    }

    const tick = async () => {
      try {
        const token = api.getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `/api/meshy/status/${jobId}?entityId=${entityId}&entityType=${entityType}`,
          { headers }
        );
        const data = (await res.json()) as {
          status?: string;
          modelPath?: string;
          error?: string;
        };

        if (!res.ok) {
          setStatus("failed");
          setError(data.error || `Status request failed (${res.status})`);
          stopPolling();
          return;
        }

        if (data.status === "done" && data.modelPath) {
          setStatus("done");
          const cacheBustedUrl = `${toRelativeStorageUrl(data.modelPath)}?t=${Date.now()}`;
          setModelUrl(cacheBustedUrl);
          onModelReady(data.modelPath);
          stopPolling();
        } else if (data.status === "failed") {
          setStatus("failed");
          setError(data.error || "3D generation failed");
          stopPolling();
        } else if (data.status) {
          setStatus(data.status as GenerationStatus);
        }
      } catch {
        // Network error, keep polling
      }
    };

    pollingRef.current = setInterval(tick, 5000);
    void tick();

    return stopPolling;
  }, [status, jobId, entityId, entityType, onModelReady, stopPolling]);

  const handleImageSelect = (files: File[]) => {
    if (files.length === 0) return;
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, 4);
    if (imgs.length === 0) return;
    if (getFirstOversizeFile(imgs)) {
      setUploadTooLargeOpen(true);
      if (imgRef.current) imgRef.current.value = "";
      return;
    }

    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingImages(imgs);
    setImagePreviews(imgs.map((f) => URL.createObjectURL(f)));
    setTexturePrompt("");
  };

  const handleImagesCancel = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingImages([]);
    setImagePreviews([]);
    setTexturePrompt("");
    if (imgRef.current) imgRef.current.value = "";
  };

  const submitMeshyJob = useCallback(async (): Promise<string | null> => {
    if (pendingImages.length === 0) return null;
    if (image3dBlockReason) {
      setUpgradeModalReason(image3dBlockReason);
      setUpgradeModalOpen(true);
      return null;
    }
    if (meshyInFlight.current) return meshyInFlight.current;

    const run = (async () => {
      setStatus("uploading");
      setError(undefined);
      try {
        const file = pendingImages[0];
        const base64 = await fileToBase64(file);
        const mimeType =
          file.type === "image/png" ? "image/png" : "image/jpeg";

        const res = await fetch("/api/meshy/generate", {
          method: "POST",
          headers: api.authJsonHeaders(),
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
            texturePrompt: texturePrompt.trim() || undefined,
          }),
        });

        const data = (await res.json()) as { jobId?: string; error?: string };

        if (!res.ok || !data.jobId) {
          const msg = data.error || "Failed to start 3D generation";
          const reason = getImage3dErrorReason(msg, res.status);
          if (reason) {
            setUpgradeModalReason(reason);
            setUpgradeModalOpen(true);
            setStatus("idle");
            return null;
          }
          throw new Error(msg);
        }

        setJobId(data.jobId);
        setStatus("queued");
        void onModelQueued?.(data.jobId);
        handleImagesCancel();
        void refreshProfile();
        return data.jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        const reason = getImage3dErrorReason(msg, 0);
        if (reason) {
          setUpgradeModalReason(reason);
          setUpgradeModalOpen(true);
          setStatus("idle");
          return null;
        }
        setStatus("failed");
        setError(msg);
        return null;
      } finally {
        meshyInFlight.current = null;
      }
    })();

    meshyInFlight.current = run;
    return run;
  }, [
    pendingImages,
    texturePrompt,
    image3dBlockReason,
    onModelQueued,
    refreshProfile,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      runPendingGeneration: async () => {
        if (pendingImages.length > 0) {
          return submitMeshyJob();
        }
        if (
          (status === "queued" || status === "processing" || status === "uploading") &&
          jobId
        ) {
          return jobId;
        }
        return null;
      },
    }),
    [pendingImages.length, status, jobId, submitMeshyJob]
  );

  const handleGenerate = () => {
    void submitMeshyJob();
  };

  const handleGlbUpload = async (file: File) => {
    if (isFileOverMaxUpload(file)) {
      setUploadTooLargeOpen(true);
      if (glbRef.current) glbRef.current.value = "";
      return;
    }
    setStatus("uploading");
    setError(undefined);

    try {
      const filename = `${entityId}.glb`;
      const result = await api.uploadModel(file, filename);

      const localUrl = URL.createObjectURL(file);
      setModelUrl(localUrl);
      setStatus("done");
      onModelReady(result.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isMaxUploadError(err) || isLikelyUploadSizeLimitMessage(msg)) {
        setUploadTooLargeOpen(true);
        setStatus("idle");
      } else {
        setStatus("failed");
        setError(msg || "GLB upload failed");
      }
    } finally {
      if (glbRef.current) glbRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const glbs = files.filter(
      (f) => f.name.endsWith(".glb") || f.name.endsWith(".gltf")
    );
    const imgs = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    if (glbs.length > 0) {
      const g = glbs[0];
      if (isFileOverMaxUpload(g)) {
        setUploadTooLargeOpen(true);
        return;
      }
      void handleGlbUpload(g);
    } else if (imgs.length > 0) {
      handleImageSelect(imgs);
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    setError(undefined);
    setJobId(null);
  };

  const handleDownload = () => {
    if (!modelUrl) return;
    const a = document.createElement("a");
    a.href = modelUrl;
    a.download = `${entityId}.glb`;
    a.click();
  };

  const isProcessing = status === "queued" || status === "processing" || status === "uploading";

  const onAiFromImages = () => {
    if (image3dBlockReason) {
      setUpgradeModalReason(image3dBlockReason);
      setUpgradeModalOpen(true);
      return;
    }
    imgRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <Image3dUpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason={upgradeModalReason}
      />
      <MessageDialog
        open={uploadTooLargeOpen}
        onClose={() => setUploadTooLargeOpen(false)}
        title={t("upload.tooLargeTitle")}
        message={t("upload.tooLargeMessage")}
        confirmText={t("common.ok")}
      />

      <label className="flex items-center gap-2 text-sm font-medium">
        <Box className="w-4 h-4" />
        3D Model
      </label>

      {image3dBlocked && (
        <div className="rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/50 px-3 py-2.5 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-fuchsia-950/20">
          <p className="text-xs leading-relaxed text-violet-950 dark:text-violet-100">
            {image3dBlockReason === "upgrade"
              ? "Upgrade your plan to use Image-to-3D generation."
              : "This month's Image-to-3D generations are used up. You can wait until next month or upgrade for a higher limit."}
          </p>
          <button
            type="button"
            onClick={() => {
              setUpgradeModalReason(image3dBlockReason ?? "limit");
              setUpgradeModalOpen(true);
            }}
            className="mt-1.5 text-xs font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
          >
            View plan options
          </button>
        </div>
      )}

      <GenerationStepper status={status} hasPendingImages={pendingImages.length > 0} />

      {/* Status indicators */}
      {(status === "queued" || status === "processing" || status === "uploading") && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              {status === "uploading"
                ? "Uploading image to Meshy..."
                : status === "queued"
                  ? "Queued for generation"
                  : "Generating 3D model..."}
            </p>
            <p className="text-xs text-blue-500 mt-0.5">
              {status === "queued"
                ? "Meshy accepted the job. We will start polling automatically."
                : "This may take a few minutes. You can leave this page and come back later."}
            </p>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Generation failed
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                {error || "Try uploading different images"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* 3D preview */}
      {status === "done" && modelUrl && (
        <div className="rounded-lg overflow-hidden border border-[var(--border)]">
          <div className="h-72 min-h-[18rem] bg-[var(--muted)] overflow-hidden">
            {modelViewerLoaded ? (
              <model-viewer
                src={modelUrl}
                alt="3D Model Preview"
                camera-controls=""
                auto-rotate=""
                camera-orbit="0deg 70deg 152%"
                field-of-view="42deg"
                min-field-of-view="18deg"
                max-field-of-view="55deg"
                min-camera-orbit="auto 22.5deg 112%"
                max-camera-orbit="auto 90deg 400%"
                shadow-intensity="1"
                exposure="1"
                style={modelViewerPreviewStyle}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">
                Loading 3D viewer...
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="block text-xs font-medium text-emerald-800">
                  3D model ready
                </span>
                <span className="block text-[11px] text-emerald-700">
                  This item now uses the generated GLB in admin and published views.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              Download GLB
            </button>
          </div>
        </div>
      )}

      {/* Upload area */}
      {!isProcessing && (
        <div
          className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
            dragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)] hover:border-[var(--primary)]/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {imagePreviews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-full h-16 object-cover rounded-md"
                  />
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Describe the object to improve the 3D model
                </label>
                <textarea
                  value={texturePrompt}
                  onChange={(e) => setTexturePrompt(e.target.value)}
                  placeholder="e.g. wooden table with dark walnut finish, smooth surface"
                  rows={2}
                  className="w-full text-sm px-3 py-2 border border-[var(--input)] bg-[var(--background)] rounded-lg placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImagesCancel}
                  className="flex-1"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (image3dBlockReason) {
                      setUpgradeModalReason(image3dBlockReason);
                      setUpgradeModalOpen(true);
                      return;
                    }
                    void handleGenerate();
                  }}
                  className="flex-1"
                >
                  <Box className="w-3.5 h-3.5 mr-1" />
                  Generate 3D Model
                </Button>
              </div>
              {entityType === "module" && (
                <p className="text-xs text-[var(--muted-foreground)] text-center leading-snug">
                  {t("modules.model3dSaveHint")}
                </p>
              )}
            </div>
          )}

          {/* Upload buttons */}
          {imagePreviews.length === 0 && (
            <>
              <div className="text-center py-2 mb-3">
                <Box className="w-8 h-8 mx-auto text-[var(--muted-foreground)] mb-1" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Drop a GLB file or images here, or use the buttons below
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  ref={glbRef}
                  type="file"
                  accept=".glb,.gltf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleGlbUpload(f);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => glbRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Upload GLB
                </Button>

                <input
                  ref={imgRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) =>
                    handleImageSelect(Array.from(e.target.files ?? []))
                  }
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAiFromImages}
                  className="flex-1"
                >
                  <ImageIcon className="w-3.5 h-3.5 mr-1" />
                  AI from Images
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

Model3DGenerator.displayName = "Model3DGenerator";

export default Model3DGenerator;
