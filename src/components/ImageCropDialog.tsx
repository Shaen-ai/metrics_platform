"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { X } from "lucide-react";

type CropPercent = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageCropDialogProps = {
  open: boolean;
  files: File[];
  title?: string;
  onCancel: () => void;
  onApply: (files: File[]) => void;
  /**
   * When set (e.g. server upload limit), each cropped or “Use original” output is checked.
   * If over this size, {@link onOutputTooLarge} runs and the crop step does not advance.
   */
  maxOutputBytes?: number;
  onOutputTooLarge?: () => void;
};

const FULL_CROP: CropPercent = { x: 0, y: 0, width: 100, height: 100 };
const MIN_CROP_SIZE = 5;

type DragMode = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

type CropDragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  startCrop: CropPercent;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMostlyWhiteOrTransparent(data: Uint8ClampedArray, i: number) {
  const a = data[i + 3] ?? 255;
  if (a < 16) return true;
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  return r > 245 && g > 245 && b > 245 && Math.max(r, g, b) - Math.min(r, g, b) < 10;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function detectContentCrop(img: HTMLImageElement): CropPercent {
  const maxScan = 900;
  const scale = Math.min(1, maxScan / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FULL_CROP;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (isMostlyWhiteOrTransparent(data, i)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return FULL_CROP;
  const pad = 2;
  minX = clamp(minX - pad, 0, w - 1);
  minY = clamp(minY - pad, 0, h - 1);
  maxX = clamp(maxX + pad, 0, w - 1);
  maxY = clamp(maxY + pad, 0, h - 1);

  const crop = {
    x: (minX / w) * 100,
    y: (minY / h) * 100,
    width: ((maxX - minX + 1) / w) * 100,
    height: ((maxY - minY + 1) / h) * 100,
  };

  if (crop.width > 98 && crop.height > 98) return FULL_CROP;
  return crop;
}

async function cropImageFile(file: File, crop: CropPercent): Promise<File> {
  const img = await loadImage(file);
  const sx = Math.round((crop.x / 100) * img.naturalWidth);
  const sy = Math.round((crop.y / 100) * img.naturalHeight);
  const sw = Math.max(1, Math.round((crop.width / 100) * img.naturalWidth));
  const sh = Math.max(1, Math.round((crop.height / 100) * img.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const mime = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (!blob) return file;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}-cropped.${ext}`, { type: mime, lastModified: Date.now() });
}

export function ImageCropDialog({
  open,
  files,
  title = "Crop image",
  onCancel,
  onApply,
  maxOutputBytes,
  onOutputTooLarge,
}: ImageCropDialogProps) {
  const [index, setIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropPercent>(FULL_CROP);
  const [croppedFiles, setCroppedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<CropDragState | null>(null);
  const file = files[index];

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setCrop(FULL_CROP);
      setCroppedFiles([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    let cancelled = false;
    void loadImage(file).then((img) => {
      if (!cancelled) setCrop(detectContentCrop(img));
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file, open]);

  const overlayStyle = useMemo(
    () => ({
      left: `${crop.x}%`,
      top: `${crop.y}%`,
      width: `${crop.width}%`,
      height: `${crop.height}%`,
    }),
    [crop],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const frame = imageFrameRef.current;
      if (!drag || !frame) return;
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / Math.max(rect.width, 1)) * 100;
      const dy = ((event.clientY - drag.startY) / Math.max(rect.height, 1)) * 100;
      const start = drag.startCrop;

      if (drag.mode === "move") {
        setCrop({
          ...start,
          x: clamp(start.x + dx, 0, 100 - start.width),
          y: clamp(start.y + dy, 0, 100 - start.height),
        });
        return;
      }

      let left = start.x;
      let top = start.y;
      let right = start.x + start.width;
      let bottom = start.y + start.height;

      if (drag.mode.includes("w")) left += dx;
      if (drag.mode.includes("e")) right += dx;
      if (drag.mode.includes("n")) top += dy;
      if (drag.mode.includes("s")) bottom += dy;

      left = clamp(left, 0, right - MIN_CROP_SIZE);
      right = clamp(right, left + MIN_CROP_SIZE, 100);
      top = clamp(top, 0, bottom - MIN_CROP_SIZE);
      bottom = clamp(bottom, top + MIN_CROP_SIZE, 100);

      setCrop({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  if (!open || !file) return null;

  const beginDrag = (mode: DragMode, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: crop,
    };
    document.body.style.cursor = mode === "move" ? "move" : `${mode}-resize`;
    document.body.style.userSelect = "none";
  };

  const applyCurrent = async (useOriginal = false) => {
    setBusy(true);
    try {
      const nextFile = useOriginal ? file : await cropImageFile(file, crop);
      if (maxOutputBytes !== undefined && nextFile.size > maxOutputBytes) {
        onOutputTooLarge?.();
        return;
      }
      const nextFiles = [...croppedFiles, nextFile];
      if (index + 1 < files.length) {
        setCroppedFiles(nextFiles);
        setIndex((i) => i + 1);
      } else {
        onApply(nextFiles);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Image {index + 1} of {files.length}: {file.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-xs text-[var(--muted-foreground)]">
            White or transparent borders are auto-detected. Drag the crop area or its handles to adjust.
            {maxOutputBytes !== undefined ? (
              <span>
                {' '}
                The exported image is checked against the upload size limit only after cropping (or choosing “Use original”).
              </span>
            ) : null}
          </p>
          <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
            {previewUrl && (
              <div ref={imageFrameRef} className="relative max-h-[520px] max-w-full">
                {/* Blob previews cannot be optimized by Next/Image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="block max-h-[520px] max-w-full object-contain" />
                <div className="absolute inset-0 bg-black/25" />
                <div
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  style={overlayStyle}
                  onPointerDown={(event) => beginDrag("move", event)}
                />
                {([
                  ["nw", "-translate-x-1/2 -translate-y-1/2 cursor-nw-resize"],
                  ["n", "-translate-x-1/2 -translate-y-1/2 cursor-n-resize"],
                  ["ne", "-translate-x-1/2 -translate-y-1/2 cursor-ne-resize"],
                  ["e", "-translate-x-1/2 -translate-y-1/2 cursor-e-resize"],
                  ["se", "-translate-x-1/2 -translate-y-1/2 cursor-se-resize"],
                  ["s", "-translate-x-1/2 -translate-y-1/2 cursor-s-resize"],
                  ["sw", "-translate-x-1/2 -translate-y-1/2 cursor-sw-resize"],
                  ["w", "-translate-x-1/2 -translate-y-1/2 cursor-w-resize"],
                ] as const).map(([mode, className]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-label={`Resize crop ${mode}`}
                    className={`absolute z-10 h-4 w-4 rounded-full border-2 border-white bg-[var(--primary)] shadow ${className}`}
                    style={{
                      left: mode.includes("w") ? `${crop.x}%` : mode.includes("e") ? `${crop.x + crop.width}%` : undefined,
                      right: undefined,
                      top: mode.includes("n") ? `${crop.y}%` : mode.includes("s") ? `${crop.y + crop.height}%` : undefined,
                      bottom: undefined,
                      ...(mode === "n" || mode === "s"
                        ? { left: `${crop.x + crop.width / 2}%` }
                        : {}),
                      ...(mode === "e" || mode === "w"
                        ? { top: `${crop.y + crop.height / 2}%` }
                        : {}),
                    }}
                    onPointerDown={(event) => beginDrag(mode, event)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <Button type="button" variant="outline" onClick={() => setCrop(FULL_CROP)} disabled={busy}>
            Reset crop
          </Button>
          <Button type="button" variant="outline" onClick={() => applyCurrent(true)} disabled={busy}>
            Use original
          </Button>
          <Button type="button" variant="primary" onClick={() => applyCurrent(false)} disabled={busy}>
            {index + 1 < files.length ? "Crop & next" : "Crop & use"}
          </Button>
        </div>
      </div>
    </div>
  );
}
