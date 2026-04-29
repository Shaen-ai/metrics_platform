"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  MessageDialog,
} from "@/components/ui";
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
  Box,
  Loader2,
} from "lucide-react";
import { currencies } from "@/lib/constants";
import { api } from "@/lib/api";
import {
  getFirstOversizeFile,
  isFileOverMaxUpload,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";
import { parseCommaCategoryTags } from "@/lib/catalogCategoryTags";

export default function NewCatalogItemPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { addCatalogItem, updateCatalogItem, currentUser, modes, fetchModes, refreshProfile } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    description: "",
    category: "",
    additionalCategories: "",
    price: "",
    currency: currentUser?.currency || "AMD",
    deliveryDays: "",
    width: "",
    height: "",
    depth: "",
    dimensionUnit: "cm",
    isActive: true,
  });
  const [colors, setColors] = useState<
    Array<{ name: string; hex: string }>
  >([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // 3D model state
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [aiImages, setAiImages] = useState<File[]>([]);
  const [aiImagePreviews, setAiImagePreviews] = useState<string[]>([]);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);
  const glbRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchModes().catch(() => {}); }, []);

  useEffect(() => {
    return () => aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [aiImagePreviews]);

  const selectedMode = modes.find((m) => m.id === currentUser?.selectedModeId);
  const adminSubModes = selectedMode?.subModes.filter((sm) =>
    currentUser?.selectedSubModeIds?.includes(sm.id)
  ) ?? [];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const addColor = () =>
    setColors([...colors, { name: "", hex: "#000000" }]);
  const removeColor = (i: number) =>
    setColors(colors.filter((_, idx) => idx !== i));
  const updateColor = (
    i: number,
    field: "name" | "hex",
    value: string
  ) => {
    const c = [...colors];
    c[i] = { ...c[i], [field]: value };
    setColors(c);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    if (getFirstOversizeFile(files)) {
      setUploadTooLargeOpen(true);
      if (photoRef.current) photoRef.current.value = "";
      return;
    }
    setUploadingImage(true);
    try {
      const uploaded = await Promise.all(files.map((f) => api.uploadImage(f)));
      setImageUrls((prev) => [...prev, ...uploaded.map((u) => u.url)]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isMaxUploadError(err) || isLikelyUploadSizeLimitMessage(msg)) {
        setUploadTooLargeOpen(true);
      } else {
        console.error("Image upload failed:", err);
      }
    } finally {
      setUploadingImage(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- 3D model handlers ---
  const handleGlbSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isFileOverMaxUpload(file)) {
        setUploadTooLargeOpen(true);
        if (glbRef.current) glbRef.current.value = "";
        return;
      }
      setGlbFile(file);
      clearAiImages();
    }
    if (glbRef.current) glbRef.current.value = "";
  };

  const clearAiImages = () => {
    aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setAiImages([]);
    setAiImagePreviews([]);
    setTexturePrompt("");
    if (imgRef.current) imgRef.current.value = "";
  };

  const handleAiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    if (files.length === 0) return;
    if (getFirstOversizeFile(files)) {
      setUploadTooLargeOpen(true);
      if (imgRef.current) imgRef.current.value = "";
      return;
    }
    setAiImages(files);
    setAiImagePreviews(files.map((f) => URL.createObjectURL(f)));
    setGlbFile(null);
    setTexturePrompt("");
    if (imgRef.current) imgRef.current.value = "";
  };

  const removeAiImage = (idx: number) => {
    const updated = aiImages.filter((_, i) => i !== idx);
    setAiImages(updated);
    setAiImagePreviews(updated.map((f) => URL.createObjectURL(f)));
  };

  const handleModelDrop = (e: React.DragEvent) => {
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
      setGlbFile(g);
      clearAiImages();
    } else if (imgs.length > 0) {
      if (getFirstOversizeFile(imgs)) {
        setUploadTooLargeOpen(true);
        return;
      }
      setAiImages(imgs);
      setAiImagePreviews(imgs.map((f) => URL.createObjectURL(f)));
      setGlbFile(null);
      setTexturePrompt("");
    }
  };

  // --- Upload helpers ---
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function triggerAiGeneration(imgFile: File, prompt?: string) {
    const base64 = await fileToBase64(imgFile);
    const mimeType =
      imgFile.type === "image/png" ? "image/png" : "image/jpeg";

    const res = await fetch("/api/meshy/generate", {
      method: "POST",
      headers: api.authJsonHeaders(),
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        texturePrompt: prompt || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.jobId) {
      throw new Error(data.error || "Failed to start 3D generation");
    }
    void refreshProfile();
    return data.jobId as string;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let modelUrl: string | undefined;
      let modelStatus: "done" | "queued" | undefined;
      let modelJobId: string | undefined;

      if (glbFile) {
        const filename = `${crypto.randomUUID()}.glb`;
        const result = await api.uploadModel(glbFile, filename);
        modelUrl = result.url;
        modelStatus = "done";
      }

      const extraTags = parseCommaCategoryTags(formData.additionalCategories);

      const newItem = await addCatalogItem({
        name: formData.name,
        model: formData.model || undefined,
        description: formData.description,
        category: formData.category,
        additionalCategories: extraTags.length > 0 ? extraTags : undefined,
        price: parseFloat(formData.price) || 0,
        currency: formData.currency,
        deliveryDays: parseInt(formData.deliveryDays) || 7,
        sizes: {
          width: parseFloat(formData.width) || 0,
          height: parseFloat(formData.height) || 0,
          depth: parseFloat(formData.depth) || 0,
          unit: formData.dimensionUnit as "cm" | "inch",
        },
        images: imageUrls,
        availableColors: colors.filter((c) => c.name.trim() !== ""),
        modeId: currentUser?.selectedModeId || "mode-furniture",
        subModeId: adminSubModes.find((sm) => sm.slug === formData.category)?.id
          || currentUser?.selectedSubModeIds?.[0] || "sub-kitchen",
        isActive: formData.isActive,
        modelUrl,
        modelStatus,
        modelJobId,
      });

      if (!newItem?.id) {
        router.push("/admin/catalog");
        return;
      }

      if (aiImages.length > 0 && !glbFile) {
        const jobId = await triggerAiGeneration(
          aiImages[0],
          texturePrompt.trim()
        );
        await updateCatalogItem(newItem.id, {
          modelJobId: jobId,
          modelStatus: "queued",
        });
        router.push(`/admin/catalog/${newItem.id}`);
      } else {
        router.push("/admin/catalog");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isMaxUploadError(err) || isLikelyUploadSizeLimitMessage(msg)) {
        setUploadTooLargeOpen(true);
      } else {
        console.error("Failed to create item:", err);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("common.back")}
      </button>

      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.addItem")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("catalog.itemName")}
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <Input
              label={t("catalog.model")}
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder={t("catalog.modelPlaceholder")}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("catalog.description_field")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("catalog.category")}
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                required
              >
                <option value="">{t("materials.selectCategory")}</option>
                {adminSubModes.map((sm) => (
                  <option key={sm.id} value={sm.slug}>
                    {sm.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("catalog.additionalCategories")}
              </label>
              <textarea
                name="additionalCategories"
                value={formData.additionalCategories}
                onChange={handleChange}
                rows={2}
                placeholder="kitchen, outdoor, living-room"
                className="w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                {t("catalog.additionalCategoriesHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t("catalog.price")}
                name="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                required
              />
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("catalog.currency")}
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label={t("catalog.deliveryDays")}
              name="deliveryDays"
              type="number"
              value={formData.deliveryDays}
              onChange={handleChange}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("catalog.dimensions")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  placeholder={t("common.width")}
                  name="width"
                  type="number"
                  value={formData.width}
                  onChange={handleChange}
                />
                <Input
                  placeholder={t("common.height")}
                  name="height"
                  type="number"
                  value={formData.height}
                  onChange={handleChange}
                />
                <Input
                  placeholder={t("common.depth")}
                  name="depth"
                  type="number"
                  value={formData.depth}
                  onChange={handleChange}
                />
                <select
                  name="dimensionUnit"
                  value={formData.dimensionUnit}
                  onChange={handleChange}
                  className="h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                >
                  <option value="cm">cm</option>
                  <option value="inch">inch</option>
                </select>
              </div>
            </div>

            {/* ─── Product Images ─── */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
                <ImageIcon className="w-4 h-4" />
                {t("catalog.images")}
              </label>
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover rounded-lg border border-[var(--border)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => photoRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Uploading...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1" />{t("catalog.addImage")}</>
                )}
              </Button>
            </div>

            {/* ─── 3D Model Section ─── */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
                <Box className="w-4 h-4" />
                3D Model
              </label>

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
                onDrop={handleModelDrop}
              >
                {/* GLB file info */}
                {glbFile && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <Box className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-800 truncate">
                          {glbFile.name}
                        </p>
                        <p className="text-xs text-emerald-600">
                          {(glbFile.size / (1024 * 1024)).toFixed(1)} MB —
                          will be uploaded when you save
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGlbFile(null)}
                        className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* AI image previews */}
                {aiImagePreviews.length > 0 && !glbFile && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {aiImages.length} image
                      {aiImages.length > 1 ? "s" : ""} selected (max 4)
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {aiImagePreviews.map((src, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={src}
                            alt=""
                            className="w-full h-16 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => removeAiImage(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                        Describe the object to improve the 3D model
                      </label>
                      <textarea
                        value={texturePrompt}
                        onChange={(e) =>
                          setTexturePrompt(e.target.value)
                        }
                        placeholder="e.g. wooden table with dark walnut finish, smooth surface"
                        rows={2}
                        className="w-full text-sm px-3 py-2 border border-[var(--input)] bg-[var(--background)] rounded-lg placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={clearAiImages}
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                {/* Upload buttons (shown when nothing selected) */}
                {!glbFile && aiImagePreviews.length === 0 && (
                  <>
                    <div className="text-center py-2 mb-3">
                      <Box className="w-8 h-8 mx-auto text-[var(--muted-foreground)] mb-1" />
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Drop a GLB file or images here
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        or use the buttons below
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        ref={glbRef}
                        type="file"
                        accept=".glb,.gltf"
                        onChange={handleGlbSelect}
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
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        multiple
                        onChange={handleAiImageSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imgRef.current?.click()}
                        className="flex-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5 mr-1" />
                        AI from Images
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] text-center mt-2">
                      Upload a .glb 3D model directly, or select 1–4 images
                      for AI 3D generation
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ─── Colors ─── */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Available Colors
              </label>
              <div className="space-y-2">
                {colors.map((color, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(e) =>
                        updateColor(index, "hex", e.target.value)
                      }
                      className="w-12 h-10 rounded border border-[var(--input)] cursor-pointer"
                    />
                    <Input
                      placeholder="Color name (e.g., Red, Blue)"
                      value={color.name}
                      onChange={(e) =>
                        updateColor(index, "name", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeColor(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addColor}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Color
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 rounded border-[var(--input)]"
              />
              <label htmlFor="isActive" className="text-sm">
                {t("catalog.activeVisible")}
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isLoading && (glbFile || aiImages.length > 0)
                  ? "Saving & uploading..."
                  : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <MessageDialog
        open={uploadTooLargeOpen}
        onClose={() => setUploadTooLargeOpen(false)}
        title={t("upload.tooLargeTitle")}
        message={t("upload.tooLargeMessage")}
        confirmText={t("common.ok")}
      />
    </div>
  );
}
