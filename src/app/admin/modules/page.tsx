"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  ConfirmDialog,
  MessageDialog,
} from "@/components/ui";
import { Plus, Search, Edit, Trash2, Box, X, ArrowDown, ArrowUp, Upload, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { currencies } from "@/lib/constants";
import Image from "next/image";
import ModelViewerCard from "@/components/ModelViewerCard";
import { api } from "@/lib/api";
import { MODULE_HANDLES } from "@/lib/moduleHandles";
import type { Module } from "@/lib/types";
import {
  getFirstOversizeFile,
  isFileOverMaxUpload,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";

function module3dListBadges(m: Module) {
  const st = m.modelStatus;
  const pending = st === "queued" || st === "processing";
  const hasUrl = Boolean(m.modelUrl);
  const ready = hasUrl && st !== "failed" && st !== "queued" && st !== "processing";
  return { pending, ready };
}

export default function ModulesPage() {
  const { t } = useTranslation();
  const {
    modules,
    materials,
    modes,
    fetchModes,
    fetchModules,
    fetchMaterials,
    addModule,
    updateModule,
    deleteModule,
    currentUser,
    refreshProfile,
  } = useStore();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Module",
    price: "",
    currency: currentUser?.currency || "AMD",
    width: "",
    height: "",
    depth: "",
    connectionTop: false,
    connectionBottom: false,
    connectionLeft: false,
    connectionRight: false,
    placementType: "floor" as "floor" | "wall",
    isConfigurableTemplate: false,
    pricingBodyWeight: "1",
    pricingDoorWeight: "1",
    defaultCabinetMaterialId: "",
    defaultDoorMaterialId: "",
    defaultHandleId: "bar-steel",
    allowedHandleIds: [] as string[],
  });

  const [templateOptionRows, setTemplateOptionRows] = useState<
    { id: string; label: string; priceDelta: string; defaultSelected: boolean }[]
  >([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moduleSaveNotice, setModuleSaveNotice] = useState<string | null>(null);
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);

  const [glbFile, setGlbFile] = useState<File | null>(null);
  /** Only true when the user picked new images/GLB area for a *new* 3D job this session. Avoids uploadImage on plain Save/update. */
  const [hasNewImageFor3dJob, setHasNewImageFor3dJob] = useState(false);
  const [aiImages, setAiImages] = useState<File[]>([]);
  const [aiImagePreviews, setAiImagePreviews] = useState<string[]>([]);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const glbRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [aiImagePreviews]);

  useEffect(() => {
    fetchModes().catch(() => {});
    fetchModules().catch(() => {});
    fetchMaterials().catch(() => {});
  }, [fetchModes, fetchModules, fetchMaterials]);

  /** Meshy only downloads the GLB and sets model_status in GET /api/meshy/status. Without polling,
   *  list view never calls it after add-module-with-AI (form closes, Model3DGenerator unmounts). */
  const meshyPendingKey = useMemo(() => {
    return modules
      .filter(
        (m) =>
          m.modelJobId &&
          (m.modelStatus === "queued" || m.modelStatus === "processing"),
      )
      .map((m) => `${m.id}:${m.modelJobId}`)
      .sort()
      .join("|");
  }, [modules]);

  useEffect(() => {
    if (!meshyPendingKey) return;

    const tick = async () => {
      const latest = useStore.getState().modules;
      const pending = latest.filter(
        (m) =>
          m.modelJobId &&
          (m.modelStatus === "queued" || m.modelStatus === "processing"),
      );
      if (pending.length === 0) return;
      const token = api.getToken();
      if (!token) return;
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      let anyOk = false;
      for (const m of pending) {
        try {
          const res = await fetch(
            `/api/meshy/status/${m.modelJobId}?entityId=${m.id}&entityType=module`,
            { headers },
          );
          if (res.ok) anyOk = true;
        } catch {
          /* keep polling */
        }
      }
      if (anyOk) void fetchModules();
    };

    const id = setInterval(tick, 8000);
    void tick();
    return () => clearInterval(id);
  }, [meshyPendingKey, fetchModules]);

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const editingTargetModule = useMemo(
    () => (editingId ? modules.find((m) => m.id === editingId) : null),
    [editingId, modules],
  );

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "Module",
      price: "",
      currency: currentUser?.currency || "AMD",
      width: "",
      height: "",
      depth: "",
      connectionTop: false,
      connectionBottom: false,
      connectionLeft: false,
      connectionRight: false,
      placementType: "floor" as "floor" | "wall",
      isConfigurableTemplate: false,
      pricingBodyWeight: "1",
      pricingDoorWeight: "1",
      defaultCabinetMaterialId: "",
      defaultDoorMaterialId: "",
      defaultHandleId: "bar-steel",
      allowedHandleIds: [],
    });
    setTemplateOptionRows([]);
    setEditingId(null);
    setShowForm(false);
    clearModelState();
  };

  const clearModelState = () => {
    setGlbFile(null);
    clearAiImages();
  };

  const clearAiImages = () => {
    aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setAiImages([]);
    setAiImagePreviews([]);
    setTexturePrompt("");
    setHasNewImageFor3dJob(false);
    if (imgRef.current) imgRef.current.value = "";
  };

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

  const handleAiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    if (files.length === 0) return;
    const over = getFirstOversizeFile(files);
    if (over) {
      setUploadTooLargeOpen(true);
      if (imgRef.current) imgRef.current.value = "";
      return;
    }
    aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setAiImages(files);
    setAiImagePreviews(files.map((f) => URL.createObjectURL(f)));
    setGlbFile(null);
    setTexturePrompt("");
    setHasNewImageFor3dJob(true);
    if (imgRef.current) imgRef.current.value = "";
  };

  const removeAiImage = (idx: number) => {
    const updated = aiImages.filter((_, i) => i !== idx);
    const previews = updated.map((f) => URL.createObjectURL(f));
    aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setAiImages(updated);
    setAiImagePreviews(previews);
    setHasNewImageFor3dJob(updated.length > 0);
  };

  const handleModelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const glbs = files.filter(
      (f) => f.name.endsWith(".glb") || f.name.endsWith(".gltf")
    );
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, 4);
    if (glbs.length > 0) {
      const g = glbs[0];
      if (isFileOverMaxUpload(g)) {
        setUploadTooLargeOpen(true);
        return;
      }
      setGlbFile(g);
      clearAiImages();
    } else if (imgs.length > 0) {
      const over = getFirstOversizeFile(imgs);
      if (over) {
        setUploadTooLargeOpen(true);
        return;
      }
      aiImagePreviews.forEach((u) => URL.revokeObjectURL(u));
      setAiImages(imgs);
      setAiImagePreviews(imgs.map((f) => URL.createObjectURL(f)));
      setGlbFile(null);
      setTexturePrompt("");
      setHasNewImageFor3dJob(true);
    }
  };

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function triggerAiGeneration(imgFile: File, prompt?: string) {
    const base64 = await fileToBase64(imgFile);
    const mimeType = imgFile.type === "image/png" ? "image/png" : "image/jpeg";
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

  const handleEdit = (module: typeof modules[0]) => {
    const w =
      module.dimensions?.width ??
      module.sizes?.width ??
      0;
    const h =
      module.dimensions?.height ??
      module.sizes?.height ??
      0;
    const d =
      module.dimensions?.depth ??
      module.sizes?.depth ??
      0;
    const cp = module.connectionPoints as Record<string, boolean> | undefined;
    setFormData({
      name: module.name,
      description: module.description,
      category: module.category || "Module",
      price: module.price.toString(),
      currency: module.currency,
      width: String(w),
      height: String(h),
      depth: String(d),
      connectionTop: !!cp?.top,
      connectionBottom: !!cp?.bottom,
      connectionLeft: !!cp?.left,
      connectionRight: !!cp?.right,
      placementType: module.placementType || "floor",
      isConfigurableTemplate: module.isConfigurableTemplate ?? false,
      pricingBodyWeight: String(module.pricingBodyWeight ?? 1),
      pricingDoorWeight: String(module.pricingDoorWeight ?? 1),
      defaultCabinetMaterialId: module.defaultCabinetMaterialId ?? "",
      defaultDoorMaterialId: module.defaultDoorMaterialId ?? "",
      defaultHandleId: module.defaultHandleId || "bar-steel",
      allowedHandleIds: module.allowedHandleIds?.length
        ? [...module.allowedHandleIds]
        : [...MODULE_HANDLES.map((h) => h.id)],
    });
    const opts = module.templateOptions ?? [];
    setTemplateOptionRows(
      opts.map((o) => ({
        id: o.id,
        label: o.label,
        priceDelta: String(o.priceDelta),
        defaultSelected: o.defaultSelected ?? false,
      })),
    );
    clearModelState();
    setEditingId(module.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dims = {
        width: parseFloat(formData.width) || 0,
        height: parseFloat(formData.height) || 0,
        depth: parseFloat(formData.depth) || 0,
        unit: "cm" as const,
      };

      let modelUrl: string | undefined;
      let modelStatus: "done" | "queued" | undefined;
      let modelJobId: string | undefined;

      if (glbFile) {
        const filename = editingId
          ? `${editingId}.glb`
          : `${crypto.randomUUID()}.glb`;
        const result = await api.uploadModel(glbFile, filename);
        modelUrl = result.url;
        modelStatus = "done";
      }

      const templateOptions = formData.isConfigurableTemplate
        ? templateOptionRows
            .filter((r) => r.id.trim() && r.label.trim())
            .map((r) => ({
              id: r.id.trim(),
              label: r.label.trim(),
              priceDelta: parseFloat(r.priceDelta) || 0,
              defaultSelected: r.defaultSelected,
            }))
        : undefined;

      const allowedHandleIdsBuilt =
        formData.isConfigurableTemplate
          ? formData.allowedHandleIds.length > 0
            ? formData.allowedHandleIds
            : MODULE_HANDLES.map((h) => h.id)
          : undefined;

      const editingModule = editingId
        ? modules.find((m) => m.id === editingId)
        : undefined;
      const resolvedModeId =
        editingModule?.modeId ??
        currentUser?.selectedModeId ??
        "mode-furniture";
      const selectedMode = modes.find((m) => m.id === resolvedModeId);
      const adminSubModes =
        selectedMode?.subModes.filter((sm) =>
          currentUser?.selectedSubModeIds?.includes(sm.id),
        ) ?? [];
      const resolvedSubModeId =
        editingModule?.subModeId ??
        adminSubModes[0]?.id ??
        selectedMode?.subModes?.[0]?.id ??
        (resolvedModeId === "mode-furniture" ? "sub-kitchen" : "");

      const shouldProcessNewAi =
        hasNewImageFor3dJob && aiImages.length > 0 && !glbFile;

      let moduleImages: string[] = [];
      if (editingId && editingModule?.images?.length) {
        moduleImages = [...editingModule.images];
      }
      if (shouldProcessNewAi) {
        try {
          const up = await api.uploadImage(aiImages[0]);
          if (editingId) {
            moduleImages = [up.url, ...moduleImages.filter((u) => u !== up.url)].slice(
              0,
              10,
            );
          } else {
            moduleImages = [up.url];
          }
        } catch (uploadErr) {
          console.error("Cover image upload failed:", uploadErr);
          throw uploadErr;
        }
      }

      const data = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        currency: formData.currency,
        modeId: resolvedModeId,
        subModeId: resolvedSubModeId,
        images: moduleImages,
        sizes: dims,
        dimensions: { ...dims, unit: "cm" },
        category: formData.category.trim() || "Module",
        connectionPoints: {
          top: formData.connectionTop,
          bottom: formData.connectionBottom,
          left: formData.connectionLeft,
          right: formData.connectionRight,
        },
        compatibleWith: [] as string[],
        isActive: true,
        placementType: formData.placementType,
        modelUrl,
        modelStatus,
        modelJobId,
        isConfigurableTemplate: formData.isConfigurableTemplate,
        ...(formData.isConfigurableTemplate
          ? {
              pricingBodyWeight: parseFloat(formData.pricingBodyWeight) || 1,
              pricingDoorWeight: parseFloat(formData.pricingDoorWeight) || 1,
              defaultCabinetMaterialId: formData.defaultCabinetMaterialId || undefined,
              defaultDoorMaterialId: formData.defaultDoorMaterialId || undefined,
              defaultHandleId: formData.defaultHandleId || "bar-steel",
              templateOptions,
              allowedHandleIds: allowedHandleIdsBuilt,
            }
          : {}),
      };

      if (editingId) {
        const id = editingId;
        const queue3d = shouldProcessNewAi;
        const imageFor3d = queue3d ? aiImages[0] : undefined;
        const textureP = texturePrompt.trim();

        await updateModule(id, data);
        setModuleSaveNotice(
          queue3d ? t("modules.updateSaved3dQueued") : t("modules.updateSaved"),
        );
        resetForm();

        if (imageFor3d) {
          void (async () => {
            try {
              const jobId = await triggerAiGeneration(imageFor3d, textureP);
              await updateModule(id, {
                modelJobId: jobId,
                modelStatus: "queued",
              });
              void fetchModules();
            } catch (e) {
              console.error("3D job failed after save:", e);
            }
          })();
        }
      } else {
        const newModule = await addModule(data);
        const newId = newModule?.id;
        const queue3d = Boolean(newId && shouldProcessNewAi);
        const imageFor3d = queue3d ? aiImages[0] : undefined;
        const textureP = texturePrompt.trim();

        setModuleSaveNotice(
          queue3d ? t("modules.addSaved3dQueued") : t("modules.addSaved"),
        );
        resetForm();

        if (newId && imageFor3d) {
          void (async () => {
            try {
              const jobId = await triggerAiGeneration(imageFor3d, textureP);
              await updateModule(newId, {
                modelJobId: jobId,
                modelStatus: "queued",
              });
              void fetchModules();
            } catch (e) {
              console.error("3D job failed after save:", e);
            }
          })();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isMaxUploadError(err) || isLikelyUploadSizeLimitMessage(msg)) {
        setUploadTooLargeOpen(true);
      } else {
        console.error(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteModule(deleteId).catch(console.error);
      setDeleteId(null);
    }
  };

  const materialOptions = useMemo(
    () => [...materials].sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  );

  const getConnectionString = (module: typeof modules[0]) => {
    const connections = [];
    if (module.connectionPoints.top) connections.push(t("modules.top"));
    if (module.connectionPoints.bottom) connections.push(t("modules.bottom"));
    if (module.connectionPoints.left) connections.push(t("modules.left"));
    if (module.connectionPoints.right) connections.push(t("modules.right"));
    return connections.join(", ") || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("modules.title")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("modules.description")}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("modules.addModule")}
        </Button>
      </div>

      {moduleSaveNotice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-[var(--foreground)]"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="flex-1 pt-0.5">{moduleSaveNotice}</p>
          <button
            type="button"
            onClick={() => setModuleSaveNotice(null)}
            className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingId ? t("modules.editModule") : t("modules.addModule")}
              </CardTitle>
              <button onClick={resetForm}>
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t("catalog.itemName")}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                />

                <Input
                  label={t("catalog.category")}
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  required
                />

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("catalog.description_field")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("catalog.price")}
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {t("catalog.currency")}
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                    >
                      {currencies.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("catalog.dimensions")} (cm)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder={t("common.width")}
                      type="number"
                      value={formData.width}
                      onChange={(e) => setFormData((p) => ({ ...p, width: e.target.value }))}
                    />
                    <Input
                      placeholder={t("common.height")}
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData((p) => ({ ...p, height: e.target.value }))}
                    />
                    <Input
                      placeholder={t("common.depth")}
                      type="number"
                      value={formData.depth}
                      onChange={(e) => setFormData((p) => ({ ...p, depth: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-4 space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isConfigurableTemplate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          isConfigurableTemplate: e.target.checked,
                          allowedHandleIds:
                            e.target.checked && p.allowedHandleIds.length === 0
                              ? MODULE_HANDLES.map((h) => h.id)
                              : p.allowedHandleIds,
                        }))
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium">Configurable template (Module Planner)</span>
                  </label>
                  {formData.isConfigurableTemplate && (
                    <div className="space-y-4 pl-0 sm:pl-1">
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Base price is the price at the default materials. Use the same unit for comparable finishes
                        (e.g. m²) so price deltas work.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Body material delta weight"
                          type="number"
                          step="0.0001"
                          min={0}
                          value={formData.pricingBodyWeight}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, pricingBodyWeight: e.target.value }))
                          }
                        />
                        <Input
                          label="Door material delta weight"
                          type="number"
                          step="0.0001"
                          min={0}
                          value={formData.pricingDoorWeight}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, pricingDoorWeight: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Default cabinet material</label>
                        <select
                          value={formData.defaultCabinetMaterialId}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              defaultCabinetMaterialId: e.target.value,
                            }))
                          }
                          className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] text-sm"
                        >
                          <option value="">— None —</option>
                          {materialOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Default door material</label>
                        <select
                          value={formData.defaultDoorMaterialId}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              defaultDoorMaterialId: e.target.value,
                            }))
                          }
                          className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] text-sm"
                        >
                          <option value="">— None —</option>
                          {materialOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Default handle</label>
                        <select
                          value={formData.defaultHandleId}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, defaultHandleId: e.target.value }))
                          }
                          className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] text-sm"
                        >
                          {MODULE_HANDLES.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} (+{h.price})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="block text-sm font-medium mb-2">Handles offered to customer</span>
                        <div className="flex flex-wrap gap-2">
                          {MODULE_HANDLES.map((h) => (
                            <label
                              key={h.id}
                              className="flex items-center gap-1.5 text-xs border border-[var(--border)] rounded-lg px-2 py-1 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.allowedHandleIds.includes(h.id)}
                                onChange={() => {
                                  setFormData((p) => {
                                    const next = new Set(p.allowedHandleIds);
                                    if (next.has(h.id)) next.delete(h.id);
                                    else next.add(h.id);
                                    return {
                                      ...p,
                                      allowedHandleIds: Array.from(next),
                                    };
                                  });
                                }}
                                className="rounded"
                              />
                              {h.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Optional extras</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTemplateOptionRows((rows) => [
                                ...rows,
                                {
                                  id: `opt-${Date.now()}`,
                                  label: "",
                                  priceDelta: "0",
                                  defaultSelected: false,
                                },
                              ])
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </div>
                        <ul className="space-y-2">
                          {templateOptionRows.map((row, idx) => (
                            <li
                              key={row.id + idx}
                              className="flex flex-wrap gap-2 items-end border border-[var(--border)] rounded-lg p-2"
                            >
                              <Input
                                label="Id"
                                className="flex-1 min-w-[80px]"
                                value={row.id}
                                onChange={(e) =>
                                  setTemplateOptionRows((rows) =>
                                    rows.map((r, i) =>
                                      i === idx ? { ...r, id: e.target.value } : r,
                                    ),
                                  )
                                }
                              />
                              <Input
                                label="Label"
                                className="flex-[2] min-w-[120px]"
                                value={row.label}
                                onChange={(e) =>
                                  setTemplateOptionRows((rows) =>
                                    rows.map((r, i) =>
                                      i === idx ? { ...r, label: e.target.value } : r,
                                    ),
                                  )
                                }
                              />
                              <Input
                                label="Price ±"
                                type="number"
                                step="0.01"
                                className="w-28"
                                value={row.priceDelta}
                                onChange={(e) =>
                                  setTemplateOptionRows((rows) =>
                                    rows.map((r, i) =>
                                      i === idx ? { ...r, priceDelta: e.target.value } : r,
                                    ),
                                  )
                                }
                              />
                              <label className="flex items-center gap-1 text-xs pb-2">
                                <input
                                  type="checkbox"
                                  checked={row.defaultSelected}
                                  onChange={(e) =>
                                    setTemplateOptionRows((rows) =>
                                      rows.map((r, i) =>
                                        i === idx
                                          ? { ...r, defaultSelected: e.target.checked }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                                Default on
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setTemplateOptionRows((rows) => rows.filter((_, i) => i !== idx))
                                }
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg mb-0.5"
                                aria-label="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3D Model — same for add and edit: Save uploads cover and queues Meshy in the background */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
                    <Box className="w-4 h-4" />
                    3D Model
                  </label>
                  {editingTargetModule &&
                    editingTargetModule.modelUrl &&
                    editingTargetModule.modelStatus === "done" &&
                    !glbFile &&
                    aiImagePreviews.length === 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                          {t("modules.current3dPreview")}
                        </p>
                        <div className="relative h-40 min-h-[10rem] bg-[var(--muted)] overflow-hidden rounded-lg border border-[var(--border)]">
                          <ModelViewerCard
                            src={editingTargetModule.modelUrl}
                            alt={editingTargetModule.name}
                            fallbackImage={
                              editingTargetModule.imageUrl ?? editingTargetModule.images[0]
                            }
                          />
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                          {t("modules.replace3dHint")}
                        </p>
                      </div>
                    )}
                    <div
                      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                        dragOver
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--border)] hover:border-[var(--primary)]/50"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleModelDrop}
                    >
                      {glbFile && (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <Box className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-800 truncate">
                              {glbFile.name}
                            </p>
                            <p className="text-xs text-emerald-600">
                              {(glbFile.size / (1024 * 1024)).toFixed(1)} MB — will be uploaded when you save
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
                      )}

                      {aiImagePreviews.length > 0 && !glbFile && (
                        <div className="space-y-3">
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {aiImages.length} image{aiImages.length > 1 ? "s" : ""} selected (max 4)
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {aiImagePreviews.map((src, i) => (
                              <div key={i} className="relative group">
                                <img src={src} alt="" className="w-full h-16 object-cover rounded-md" />
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
                              onChange={(e) => setTexturePrompt(e.target.value)}
                              placeholder="e.g. wooden cabinet with dark walnut finish"
                              rows={2}
                              className="w-full text-sm px-3 py-2 border border-[var(--input)] bg-[var(--background)] rounded-lg placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                            />
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] leading-snug">
                            {t("modules.addAiSaveHint")}
                          </p>
                          <button
                            type="button"
                            onClick={clearAiImages}
                            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}

                      {!glbFile && aiImagePreviews.length === 0 && (
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
                              accept="image/jpeg,image/png,image/webp"
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
                            Upload a .glb 3D model directly, or select images for AI 3D generation
                          </p>
                        </>
                      )}
                    </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Placement Type
                  </label>
                  <div className="flex gap-2">
                    {(["floor", "wall"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, placementType: type }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          formData.placementType === type
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                            : "border-[var(--input)] hover:border-[var(--primary)]/50"
                        }`}
                      >
                        {type === "floor" ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                        {type === "floor" ? "Floor Unit" : "Wall Unit"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("modules.connectionPoints")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "connectionTop", label: t("modules.top") },
                      { key: "connectionBottom", label: t("modules.bottom") },
                      { key: "connectionLeft", label: t("modules.left") },
                      { key: "connectionRight", label: t("modules.right") },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData[key as keyof typeof formData] as boolean}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, [key]: e.target.checked }))
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving...</>
                    ) : (
                      t("common.save")
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modules List */}
      {filteredModules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h3 className="font-medium mb-2">{t("modules.noModules")}</h3>
            <p className="text-[var(--muted-foreground)] mb-4">{t("modules.addFirst")}</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("modules.addModule")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((module) => (
            <Card key={module.id} className="overflow-hidden">
              <div className="relative h-48 min-h-[12rem] bg-[var(--muted)] overflow-hidden">
                {module.modelUrl && module.modelStatus === "done" ? (
                  <ModelViewerCard
                    src={module.modelUrl}
                    alt={module.name}
                    fallbackImage={module.imageUrl ?? module.images[0]}
                  />
                ) : module.imageUrl || module.images[0] ? (
                  <Image
                    src={module.imageUrl ?? module.images[0]!}
                    alt={module.name}
                    fill
                    className="object-cover"
                  />
                ) : module.modelStatus === "queued" || module.modelStatus === "processing" ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-xs font-medium text-blue-600">Generating 3D...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Box className="w-10 h-10 text-[var(--muted-foreground)]" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium">{module.name}</h3>
                  <p className="font-bold text-[var(--primary)]">
                    {formatPrice(module.price, module.currency)}
                  </p>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mb-2 line-clamp-2">
                  {module.description}
                </p>
                <div className="text-xs text-[var(--muted-foreground)] mb-2">
                  {(module.dimensions ?? module.sizes).width} × {(module.dimensions ?? module.sizes).height} ×{" "}
                  {(module.dimensions ?? module.sizes).depth} cm
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mb-2">
                  <span className="font-medium">{t("modules.connections")}:</span>{" "}
                  {getConnectionString(module)}
                </div>
                <div className="flex gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    module.placementType === "wall"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {module.placementType === "wall" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {module.placementType === "wall" ? "Wall" : "Floor"}
                  </span>
                  {(() => {
                    const { pending, ready } = module3dListBadges(module);
                    if (pending) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                          <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                          3D
                        </span>
                      );
                    }
                    if (ready) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                          <Box className="w-3 h-3" />
                          3D
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {module.isConfigurableTemplate && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800">
                      Template
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(module)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(module.id)}
                    className="text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MessageDialog
        open={uploadTooLargeOpen}
        onClose={() => setUploadTooLargeOpen(false)}
        title={t("upload.tooLargeTitle")}
        message={t("upload.tooLargeMessage")}
        confirmText={t("common.ok")}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title={t("common.confirmDeleteTitle")}
        message={t("common.confirmDeleteMessage")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="danger"
      />
    </div>
  );
}
