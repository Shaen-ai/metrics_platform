"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Plus, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { currencies } from "@/lib/constants";
import { api } from "@/lib/api";
import {
  getFirstOversizeFile,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";
import Model3DGenerator from "@/components/Model3DGenerator";
import { CatalogAdditionalCategoriesDropdown } from "@/components/CatalogAdditionalCategoriesDropdown";

export default function EditCatalogItemPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { catalogItems, fetchCatalogItems, updateCatalogItem, currentUser, modes, fetchModes } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    description: "",
    category: "",
    additionalCategories: [] as string[],
    price: "",
    currency: "AMD",
    deliveryDays: "",
    width: "",
    height: "",
    depth: "",
    dimensionUnit: "cm",
    isActive: true,
  });
  const [colors, setColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const itemId = params.id as string;
  const item = catalogItems.find((i) => i.id === itemId);

  useEffect(() => { fetchCatalogItems().catch(() => {}); fetchModes().catch(() => {}); }, [fetchCatalogItems, fetchModes]);

  const selectedSubModeIds = new Set(currentUser?.selectedSubModeIds ?? []);
  const adminSubModes = modes.flatMap((mode) =>
    mode.subModes
      .filter((sm) => selectedSubModeIds.has(sm.id) || sm.id === item?.subModeId)
      .map((sm) => ({ ...sm, modeName: mode.name, modeId: mode.id })),
  );
  const primaryCategorySlug =
    adminSubModes.find((sm) => sm.id === formData.category)?.slug ??
    adminSubModes.find((sm) => sm.slug === formData.category)?.slug ??
    formData.category;
  const additionalCategoryOptions = [
    ...adminSubModes.map((sm) => ({
      value: sm.slug,
      label: `${sm.modeName} / ${sm.name}`,
      disabled: sm.slug === primaryCategorySlug,
    })),
    ...formData.additionalCategories
      .filter((value) => !adminSubModes.some((sm) => sm.slug === value))
      .map((value) => ({ value, label: value })),
  ];

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        model: item.model || "",
        description: item.description,
        category: item.subModeId || item.category,
        additionalCategories: item.additionalCategories ?? [],
        price: item.price.toString(),
        currency: item.currency,
        deliveryDays: item.deliveryDays.toString(),
        width: item.sizes?.width?.toString() || "0",
        height: item.sizes?.height?.toString() || "0",
        depth: item.sizes?.depth?.toString() || "0",
        dimensionUnit: item.sizes?.unit || "cm",
        isActive: item.isActive,
      });
      setColors(item.availableColors || []);
      setImageUrls(item.images || []);
    }
  }, [item]);

  if (!item) {
    return (
      <div className="text-center py-12">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const selectedSlug =
      adminSubModes.find((sm) => sm.id === value)?.slug ??
      adminSubModes.find((sm) => sm.slug === value)?.slug ??
      value;

    setFormData((prev) => ({
      ...prev,
      category: value,
      additionalCategories: prev.additionalCategories.filter(
        (category) => category !== selectedSlug,
      ),
    }));
  };

  const addColor = () => {
    setColors([...colors, { name: "", hex: "#000000" }]);
  };

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, field: "name" | "hex", value: string) => {
    const newColors = [...colors];
    newColors[index] = { ...newColors[index], [field]: value };
    setColors(newColors);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const selectedSubMode =
      adminSubModes.find((sm) => sm.id === formData.category) ??
      adminSubModes.find((sm) => sm.slug === formData.category);
    const extraTags = formData.additionalCategories.filter(
      (category) => category !== (selectedSubMode?.slug ?? formData.category),
    );

    await updateCatalogItem(itemId, {
      name: formData.name,
      model: formData.model || undefined,
      description: formData.description,
      category: selectedSubMode?.slug ?? formData.category,
      additionalCategories: extraTags,
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
      modeId: selectedSubMode?.modeId,
      subModeId: selectedSubMode?.id,
      isActive: formData.isActive,
    });

    router.push("/admin/catalog");
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
          <CardTitle>{t("catalog.editItem")}</CardTitle>
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
                onChange={handleCategoryChange}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                required
              >
                <option value="">{t("materials.selectCategory")}</option>
                {adminSubModes.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.modeName} / {sm.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("catalog.additionalCategories")}
              </label>
              <CatalogAdditionalCategoriesDropdown
                options={additionalCategoryOptions}
                value={formData.additionalCategories}
                onChange={(additionalCategories) =>
                  setFormData((prev) => ({
                    ...prev,
                    additionalCategories: additionalCategories.filter(
                      (category) => category !== primaryCategorySlug,
                    ),
                  }))
                }
                placeholder={t("catalog.additionalCategoriesPlaceholder")}
                emptyLabel={t("catalog.noAdditionalCategories")}
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

            {/* 3D Model — primary media section */}
            <Model3DGenerator
              entityId={itemId}
              entityType="catalog"
              currentModelUrl={item.modelUrl}
              currentStatus={item.modelStatus}
              currentJobId={item.modelJobId}
              onModelQueued={(jobId) =>
                updateCatalogItem(itemId, {
                  modelJobId: jobId,
                  modelStatus: "queued",
                  modelError: "",
                })
              }
              onModelReady={(url) => updateCatalogItem(itemId, { modelUrl: url, modelStatus: "done" })}
            />

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
                      onChange={(e) => updateColor(index, "hex", e.target.value)}
                      className="w-12 h-10 rounded border border-[var(--input)] cursor-pointer"
                    />
                    <Input
                      placeholder="Color name (e.g., Red, Blue)"
                      value={color.name}
                      onChange={(e) => updateColor(index, "name", e.target.value)}
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
                <Button type="button" variant="outline" size="sm" onClick={addColor}>
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
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {t("common.save")}
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
