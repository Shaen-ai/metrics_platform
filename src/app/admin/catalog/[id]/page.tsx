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
import { ArrowLeft, Plus, X, Upload, Link as LinkIcon, Image as ImageIcon, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { currencies } from "@/lib/constants";
import { api } from "@/lib/api";
import {
  MAX_UPLOAD_BYTES,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";
import Model3DGenerator from "@/components/Model3DGenerator";
import { CatalogAdditionalCategoriesDropdown } from "@/components/CatalogAdditionalCategoriesDropdown";
import { SURFACE_SUBCATEGORY_OPTIONS, ALL_SURFACE_SUBCATEGORY_VALUES } from "@/lib/buildingMaterialCategories";
import type { FabricPart } from "@/lib/types";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { ErrorReportDialog } from "@/components/ErrorReportDialog";

export default function EditCatalogItemPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const {
    catalogItems,
    fetchCatalogItems,
    updateCatalogItem,
    currentUser,
    modes,
    fetchModes,
    materials,
    fetchMaterials,
  } = useStore();
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
    forDesign: false,
    supportsOutdoorCushions: false,
    plannerSubcategory: "",
    surfaceTextureWidthCm: "",
    surfaceTextureHeightCm: "",
    surfaceItemWidthCm: "",
    surfaceItemHeightCm: "",
    surfaceLayoutPattern: "",
    surfaceSubcategory: "",
    unit: "",
  });
  const [isFabricCustomizable, setIsFabricCustomizable] = useState(false);
  const [fabricParts, setFabricParts] = useState<FabricPart[]>([]);
  const [fabricPartPickerOpen, setFabricPartPickerOpen] = useState<string | null>(null);
  const [colors, setColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSourceTab, setImageSourceTab] = useState<"upload" | "url">("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);
  const [cropFiles, setCropFiles] = useState<File[] | null>(null);
  const [errorReportOpen, setErrorReportOpen] = useState(false);
  const [errorReportMessage, setErrorReportMessage] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const itemId = params.id as string;
  const item = catalogItems.find((i) => i.id === itemId);

  useEffect(() => {
    fetchCatalogItems().catch(() => {});
    fetchModes().catch(() => {});
    fetchMaterials().catch(() => {});
  }, [fetchCatalogItems, fetchModes, fetchMaterials]);

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
  const selectedPrimarySubMode =
    adminSubModes.find((sm) => sm.id === formData.category) ??
    adminSubModes.find((sm) => sm.slug === formData.category);
  const isFurnitureOutdoorPrimary =
    selectedPrimarySubMode?.modeId === "mode-furniture" &&
    selectedPrimarySubMode?.slug === "outdoor";
  const SURFACE_SUB_MODE_IDS = new Set(["sub-building-flooring", "sub-building-wall-finishes", "sub-building-ceiling-materials", "sub-building-plinth"]);
  const isSurfaceMaterial = SURFACE_SUB_MODE_IDS.has(selectedPrimarySubMode?.id ?? "");
  const isFlooringMode = selectedPrimarySubMode?.id === "sub-building-flooring";
  const isBuildingMaterial = selectedPrimarySubMode?.modeId === "mode-building-materials";
  const isFurnitureMode =
    selectedPrimarySubMode?.modeId === "mode-furniture" ||
    selectedPrimarySubMode?.modeId === "mode-soft-furniture";

  const UPHOLSTERY_EXCLUDED_SUB_MODES = new Set([
    "sub-building-flooring",
    "sub-building-wall-finishes",
    "sub-building-ceiling-materials",
    "sub-building-plinth",
  ]);
  const upholsteryMaterials = materials.filter((m) => {
    if (m.subModeId && UPHOLSTERY_EXCLUDED_SUB_MODES.has(m.subModeId)) return false;
    const typeLower = (m.type ?? "").toLowerCase();
    const catLower = (m.category ?? "").toLowerCase();
    const types: string[] = Array.isArray(m.types) ? m.types.map((t: string) => t.toLowerCase()) : [];
    const cats: string[] = Array.isArray(m.categories) ? m.categories.map((c: string) => c.toLowerCase()) : [];
    return (
      typeLower === "fabric" || typeLower === "leather" || typeLower === "boucle" ||
      catLower === "upholstery" ||
      types.some((t) => t === "fabric" || t === "leather" || t === "boucle") ||
      cats.some((c) => c === "upholstery")
    );
  });

  const priceUnits = [
    { value: "sqm", label: t("unit.sqm") },
    { value: "meter", label: t("unit.meter") },
    { value: "piece", label: t("unit.piece") },
    { value: "roll", label: t("unit.roll") },
    { value: "box", label: t("unit.box") },
    { value: "kg", label: t("unit.kg") },
  ];
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
        additionalCategories: (item.additionalCategories ?? []).filter((c) => !ALL_SURFACE_SUBCATEGORY_VALUES.has(c)),
        price: item.price.toString(),
        currency: item.currency,
        deliveryDays: item.deliveryDays.toString(),
        width: item.sizes?.width?.toString() || "0",
        height: item.sizes?.height?.toString() || "0",
        depth: item.sizes?.depth?.toString() || "0",
        dimensionUnit: item.sizes?.unit || "cm",
        isActive: item.isActive,
        forDesign: item.forDesign === true,
        supportsOutdoorCushions: item.supportsOutdoorCushions === true,
        plannerSubcategory: item.plannerSubcategory ?? "",
        surfaceTextureWidthCm: item.surfaceTextureWidthCm != null ? String(item.surfaceTextureWidthCm) : "",
        surfaceTextureHeightCm: item.surfaceTextureHeightCm != null ? String(item.surfaceTextureHeightCm) : "",
        surfaceItemWidthCm: item.surfaceItemWidthCm != null ? String(item.surfaceItemWidthCm) : "",
        surfaceItemHeightCm: item.surfaceItemHeightCm != null ? String(item.surfaceItemHeightCm) : "",
        surfaceLayoutPattern: item.surfaceLayoutPattern ?? "",
        surfaceSubcategory: (item.additionalCategories ?? []).find((c) => ALL_SURFACE_SUBCATEGORY_VALUES.has(c)) ?? "",
        unit: item.unit ?? "",
      });
      setColors(item.availableColors || []);
      setImageUrls(item.images || []);
      setIsFabricCustomizable(item.isFabricCustomizable === true);
      setFabricParts(item.fabricParts ?? []);
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
      surfaceSubcategory: "",
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

  const addFabricPart = () => {
    if (fabricParts.length >= 6) return;
    const id = `part_${Date.now()}`;
    setFabricParts((prev) => [...prev, { id, name: "", allowedMaterialIds: null }]);
  };

  const removeFabricPart = (id: string) => {
    setFabricParts((prev) => prev.filter((p) => p.id !== id));
    if (fabricPartPickerOpen === id) setFabricPartPickerOpen(null);
  };

  const updateFabricPartName = (id: string, name: string) => {
    setFabricParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const toggleFabricPartMaterial = (partId: string, materialId: string) => {
    setFabricParts((prev) =>
      prev.map((p) => {
        if (p.id !== partId) return p;
        if (p.allowedMaterialIds === null) return p;
        const exists = p.allowedMaterialIds.includes(materialId);
        return {
          ...p,
          allowedMaterialIds: exists
            ? p.allowedMaterialIds.filter((id) => id !== materialId)
            : [...p.allowedMaterialIds, materialId],
        };
      }),
    );
  };

  const setFabricPartAllowMode = (partId: string, mode: "all" | "specific") => {
    setFabricParts((prev) =>
      prev.map((p) => {
        if (p.id !== partId) return p;
        return { ...p, allowedMaterialIds: mode === "all" ? null : [] };
      }),
    );
  };

  const uploadPhotoFiles = async (files: File[]) => {
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
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    setCropFiles(files);
    if (photoRef.current) photoRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
    const selectedSubMode =
      adminSubModes.find((sm) => sm.id === formData.category) ??
      adminSubModes.find((sm) => sm.slug === formData.category);
    const furnitureOutdoorPrimary =
      selectedSubMode?.modeId === "mode-furniture" &&
      selectedSubMode?.slug === "outdoor";
    const supportsOutdoorCushions =
      furnitureOutdoorPrimary && formData.supportsOutdoorCushions;
    const extraTags = [
      ...formData.additionalCategories.filter(
        (category) =>
          category !== (selectedSubMode?.slug ?? formData.category) &&
          !ALL_SURFACE_SUBCATEGORY_VALUES.has(category),
      ),
      ...(formData.surfaceSubcategory ? [formData.surfaceSubcategory] : []),
    ];

    // Auto-include any URL typed in the URL tab but not yet clicked "Add"
    const pendingUrl = imageUrlInput.trim();
    const finalImages = pendingUrl && !imageUrls.includes(pendingUrl)
      ? [...imageUrls, pendingUrl]
      : imageUrls;

    await updateCatalogItem(itemId, {
      name: formData.name,
      model: formData.model || undefined,
      description: formData.description,
      category: selectedSubMode?.slug ?? formData.category,
      additionalCategories: extraTags,
      plannerSubcategory: formData.plannerSubcategory.trim()
        ? formData.plannerSubcategory.trim()
        : null,
      price: parseFloat(formData.price) || 0,
      currency: formData.currency,
      deliveryDays: parseInt(formData.deliveryDays) || 7,
      sizes: {
        width: parseFloat(formData.width) || 0,
        height: parseFloat(formData.height) || 0,
        depth: parseFloat(formData.depth) || 0,
        unit: formData.dimensionUnit as "cm" | "inch",
      },
      images: finalImages,
      availableColors: colors.filter((c) => c.name.trim() !== ""),
      modeId: selectedSubMode?.modeId,
      subModeId: selectedSubMode?.id,
      isActive: formData.isActive,
      forDesign: formData.forDesign,
      supportsOutdoorCushions,
      outdoorCushionDefaults: null,
      isFabricCustomizable: isFurnitureMode && isFabricCustomizable,
      fabricParts: isFurnitureMode && isFabricCustomizable ? fabricParts : [],
      surfaceTextureWidthCm: formData.surfaceTextureWidthCm ? parseFloat(formData.surfaceTextureWidthCm) : null,
      surfaceTextureHeightCm: formData.surfaceTextureHeightCm ? parseFloat(formData.surfaceTextureHeightCm) : null,
      surfaceItemWidthCm: formData.surfaceItemWidthCm ? parseFloat(formData.surfaceItemWidthCm) : null,
      surfaceItemHeightCm: formData.surfaceItemHeightCm ? parseFloat(formData.surfaceItemHeightCm) : null,
      surfaceLayoutPattern: (formData.surfaceLayoutPattern as 'aligned' | 'staggered' | 'herringbone') || null,
      unit: formData.unit || null,
    });

    router.push("/admin/catalog");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorReportMessage(msg);
      setErrorReportOpen(true);
    } finally {
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

            <Input
              label={t("catalog.plannerSubgroup")}
              name="plannerSubcategory"
              value={formData.plannerSubcategory}
              onChange={handleChange}
              placeholder="e.g. Appliances, Cabinets, Lighting"
            />
            <p className="text-xs text-[var(--muted-foreground)] -mt-2 mb-1">
              {t("catalog.plannerSubgroupHint")}
            </p>

            <div className={`grid gap-4 ${isBuildingMaterial ? "grid-cols-3" : "grid-cols-2"}`}>
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
              {isBuildingMaterial && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Price per
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="">— select —</option>
                    {priceUnits.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <Input
              label={t("catalog.deliveryDays")}
              name="deliveryDays"
              type="number"
              value={formData.deliveryDays}
              onChange={handleChange}
            />

            {!isBuildingMaterial && (
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
            )}

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
              {/* Source tab switcher */}
              <div className="inline-flex rounded-lg border border-[var(--input)] p-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => setImageSourceTab("upload")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    imageSourceTab === "upload"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageSourceTab("url")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    imageSourceTab === "url"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  URL
                </button>
              </div>
              {imageSourceTab === "upload" ? (
                <>
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div className="block">
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
                </>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/product.jpg"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const url = imageUrlInput.trim();
                        if (url && !imageUrls.includes(url)) {
                          setImageUrls((prev) => [...prev, url]);
                        }
                        setImageUrlInput("");
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = imageUrlInput.trim();
                      if (url && !imageUrls.includes(url)) {
                        setImageUrls((prev) => [...prev, url]);
                      }
                      setImageUrlInput("");
                    }}
                    disabled={!imageUrlInput.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              )}
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

            {isFurnitureOutdoorPrimary && (
              <div className="rounded-lg border border-[var(--border)] p-4 space-y-3 bg-[var(--muted)]/20">
                <p className="text-sm font-medium">Outdoor planner · cushions</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supportsOutdoorCushions}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, supportsOutdoorCushions: e.target.checked }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Enable cushion customization for this product in the outdoor planner</span>
                </label>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Seat layout, materials, and cushion sizes are configured by customers in the outdoor planner.
                </p>
              </div>
            )}

            {isFurnitureMode && (
              <div className="rounded-lg border border-[var(--border)] p-4 space-y-4 bg-[var(--muted)]/20">
                <p className="text-sm font-medium">Fabric customization</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFabricCustomizable}
                    onChange={(e) => setIsFabricCustomizable(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Allow fabric customization for this product</span>
                </label>

                {isFabricCustomizable && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Define the parts of this product that can have different fabrics (e.g. Seat, Back, Arms). Customers will pick a fabric per part in the planner.
                    </p>

                    {fabricParts.map((part) => (
                      <div key={part.id} className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Part name (e.g. Seat, Back, Left Arm)"
                            value={part.name}
                            onChange={(e) => updateFabricPartName(part.id, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeFabricPart(part.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`allow-mode-${part.id}`}
                              checked={part.allowedMaterialIds === null}
                              onChange={() => setFabricPartAllowMode(part.id, "all")}
                              className="w-4 h-4"
                            />
                            All fabrics
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`allow-mode-${part.id}`}
                              checked={part.allowedMaterialIds !== null}
                              onChange={() => setFabricPartAllowMode(part.id, "specific")}
                              className="w-4 h-4"
                            />
                            Specific fabrics only
                          </label>
                        </div>

                        {part.allowedMaterialIds !== null && (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                setFabricPartPickerOpen(
                                  fabricPartPickerOpen === part.id ? null : part.id,
                                )
                              }
                              className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            >
                              {fabricPartPickerOpen === part.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              {part.allowedMaterialIds.length === 0
                                ? "No fabrics selected — click to choose"
                                : `${part.allowedMaterialIds.length} fabric${part.allowedMaterialIds.length !== 1 ? "s" : ""} selected — click to edit`}
                            </button>

                            {fabricPartPickerOpen === part.id && (
                              <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)] divide-y divide-[var(--border)]">
                                {upholsteryMaterials.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                                    No upholstery materials found. Add fabric/leather/bouclé materials in the Materials section first.
                                  </p>
                                ) : (
                                  upholsteryMaterials.map((m) => {
                                    const checked = part.allowedMaterialIds?.includes(m.id) ?? false;
                                    return (
                                      <label
                                        key={m.id}
                                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--accent)] transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleFabricPartMaterial(part.id, m.id)}
                                          className="w-4 h-4 shrink-0"
                                        />
                                        {m.imageUrl ? (
                                          <img
                                            src={m.imageUrl}
                                            alt={m.name}
                                            className="w-8 h-8 rounded object-cover border border-[var(--border)] shrink-0"
                                          />
                                        ) : (
                                          <div
                                            className="w-8 h-8 rounded border border-[var(--border)] shrink-0"
                                            style={{ backgroundColor: m.colorHex || "#ccc" }}
                                          />
                                        )}
                                        <span className="text-sm leading-tight">
                                          {m.name}
                                          {m.type && (
                                            <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
                                              ({m.type})
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {fabricParts.length < 6 && (
                      <Button type="button" variant="outline" size="sm" onClick={addFabricPart}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add part
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {isSurfaceMaterial && (
              <div className="rounded-lg border border-[var(--border)] p-4 space-y-4 bg-[var(--muted)]/20">
                <p className="text-sm font-medium">Surface dimensions</p>

                {SURFACE_SUBCATEGORY_OPTIONS[selectedPrimarySubMode?.id ?? ""] && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Type</label>
                    <select
                      name="surfaceSubcategory"
                      value={formData.surfaceSubcategory}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="">— select type —</option>
                      {(SURFACE_SUBCATEGORY_OPTIONS[selectedPrimarySubMode?.id ?? ""] ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                    Texture photo size — real-world area the photo represents
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Photo width (cm)"
                      name="surfaceTextureWidthCm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.surfaceTextureWidthCm}
                      onChange={handleChange}
                      placeholder="e.g. 60"
                    />
                    <Input
                      label="Photo height (cm)"
                      name="surfaceTextureHeightCm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.surfaceTextureHeightCm}
                      onChange={handleChange}
                      placeholder="e.g. 60"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                    One item / roll size — used to calculate quantity needed
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Item width (cm)"
                      name="surfaceItemWidthCm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.surfaceItemWidthCm}
                      onChange={handleChange}
                      placeholder="e.g. 53"
                    />
                    <Input
                      label="Item height / length (cm)"
                      name="surfaceItemHeightCm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.surfaceItemHeightCm}
                      onChange={handleChange}
                      placeholder="e.g. 1000"
                    />
                  </div>
                </div>

                {isFlooringMode && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Layout pattern</label>
                    <select
                      name="surfaceLayoutPattern"
                      value={formData.surfaceLayoutPattern}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    >
                      <option value="">— none —</option>
                      <option value="aligned">Aligned</option>
                      <option value="staggered">Staggered</option>
                      <option value="herringbone">Herringbone</option>
                    </select>
                  </div>
                )}
              </div>
            )}

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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forDesign"
                name="forDesign"
                checked={formData.forDesign}
                onChange={handleChange}
                className="w-4 h-4 rounded border-[var(--input)]"
              />
              <label htmlFor="forDesign" className="text-sm">
                For Design only <span className="text-xs text-[var(--muted-foreground)]">(hidden from public catalog)</span>
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
      <ImageCropDialog
        open={Boolean(cropFiles)}
        files={cropFiles ?? []}
        title="Crop product images"
        maxOutputBytes={MAX_UPLOAD_BYTES}
        onOutputTooLarge={() => setUploadTooLargeOpen(true)}
        onCancel={() => setCropFiles(null)}
        onApply={(files) => {
          setCropFiles(null);
          void uploadPhotoFiles(files);
        }}
      />
      <ErrorReportDialog
        open={errorReportOpen}
        onClose={() => setErrorReportOpen(false)}
        error={errorReportMessage}
      />
    </div>
  );
}
