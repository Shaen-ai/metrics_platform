"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Layers,
  X,
  Upload,
  Link as LinkIcon,
  AlertTriangle,
  Library,
  CheckSquare,
  Square,
  TreePine,
  Sandwich,
  ChevronsLeftRight,
  ChevronDown,
  Loader2,
  PanelsTopLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { currencies } from "@/lib/constants";
import { api } from "@/lib/api";
import {
  DEFAULT_SHEET_WIDTH_CM,
  DEFAULT_SHEET_HEIGHT_CM,
  DEFAULT_KERF_MM,
  isSheetedMaterialFromTypes,
} from "@/lib/sheetSpec";
import { BUILDING_MATERIAL_CATEGORY_GROUPS } from "@/lib/buildingMaterialCategories";
import type { FloorLayoutPattern, Material, MaterialGrainDirection, MaterialTemplate } from "@/lib/types";
import {
  MAX_UPLOAD_BYTES,
  isFileOverMaxUpload,
  isLikelyUploadSizeLimitMessage,
  isMaxUploadError,
} from "@/lib/uploadLimits";
import { ImageCropDialog } from "@/components/ImageCropDialog";

/** Display order for grouped sections (must include every selectable material type). */
const MATERIAL_TYPE_ORDER: string[] = [
  "laminate",
  "mdf",
  "wood",
  "worktop",
  "slide",
  "hinge",
  "handle",
  "metal",
  "fabric",
  "paper",
  "boucle",
  "leather",
  "glass",
  "plastic",
  "stone",
];

/** Preferred chip order for brand filters (extend when the full list is provided). */
const BRAND_DISPLAY_ORDER: string[] = [
  "egger",
  "domus",
  "kastamonu",
  "alvic",
  "cleaf",
  "evogloss",
  "agt",
  "starwood",
];

/** Max swatches per brand group before "Show more" (keeps DOM and image requests down). */
const GROUP_PAGE_SIZE = 20;
const FLOORING_CATEGORY_PREFIX = "building-flooring-";
const WALL_CATEGORY_PREFIX = "building-wall-";
const WALLPAPER_CATEGORY = "building-wall-wallpaper";

/** Sub-modes tied to BUILDING_MATERIAL_CATEGORY_GROUPS — used even when primary `selectedModeId` is another mode */
const BUILDING_MATERIAL_SUBMODE_IDS = new Set(
  BUILDING_MATERIAL_CATEGORY_GROUPS.map((g) => g.subModeId),
);

/** Planner sub-modes under `mode-soft-furniture` (matches `ModeSeeder`). Shown whenever any are enabled. */
const SOFT_FURNITURE_SUBMODE_IDS = new Set([
  "sub-sofas",
  "sub-armchairs",
  "sub-ottomans",
  "sub-mattresses",
  "sub-headboards",
]);

type MaterialProductChoice = {
  id: string;
  labelKey: string;
  types: string[];
  categories: string[];
  unit: string;
  subModeId?: string;
  floorLayoutPattern?: FloorLayoutPattern;
};

type MaterialProductGroup = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  choices: MaterialProductChoice[];
};

const FURNITURE_PRODUCT_GROUPS: MaterialProductGroup[] = [
  {
    id: "furniture-cabinet",
    labelKey: "materials.productGroup.furnitureCabinet",
    descriptionKey: "materials.productGroup.furnitureCabinetDesc",
    choices: [
      { id: "cabinet-laminate", labelKey: "material.laminate", types: ["laminate"], categories: ["surface", "door", "frame"], unit: "sqm" },
      { id: "cabinet-mdf", labelKey: "material.mdf", types: ["mdf"], categories: ["frame", "door", "surface"], unit: "sqm" },
      { id: "cabinet-wood", labelKey: "material.wood", types: ["wood"], categories: ["frame", "surface", "door"], unit: "sqm" },
      { id: "cabinet-worktop", labelKey: "material.worktop", types: ["worktop"], categories: ["worktop", "surface"], unit: "sqm" },
      { id: "cabinet-glass", labelKey: "material.glass", types: ["glass"], categories: ["door", "surface"], unit: "sqm" },
      { id: "cabinet-metal", labelKey: "material.metal", types: ["metal"], categories: ["frame", "hardware"], unit: "meter" },
      { id: "cabinet-stone", labelKey: "material.stone", types: ["stone"], categories: ["worktop", "surface"], unit: "sqm" },
      { id: "cabinet-plastic", labelKey: "material.plastic", types: ["plastic"], categories: ["surface"], unit: "sqm" },
    ],
  },
  {
    id: "hardware",
    labelKey: "materials.productGroup.hardware",
    descriptionKey: "materials.productGroup.hardwareDesc",
    choices: [
      { id: "hardware-handle", labelKey: "material.handle", types: ["handle"], categories: ["hardware"], unit: "piece" },
      { id: "hardware-hinge", labelKey: "material.hinge", types: ["hinge"], categories: ["hardware"], unit: "piece" },
      { id: "hardware-slide", labelKey: "material.slide", types: ["slide"], categories: ["hardware"], unit: "piece" },
    ],
  },
];

const SOFT_FURNITURE_PRODUCT_GROUPS: MaterialProductGroup[] = [
  {
    id: "soft-upholstery",
    labelKey: "materials.productGroup.softUpholstery",
    descriptionKey: "materials.productGroup.softUpholsteryDesc",
    choices: [
      { id: "soft-fabric", labelKey: "material.fabric", types: ["fabric"], categories: ["upholstery", "finish"], unit: "sqm" },
      { id: "soft-boucle", labelKey: "material.boucle", types: ["boucle"], categories: ["upholstery", "finish"], unit: "sqm" },
      { id: "soft-leather", labelKey: "material.leather", types: ["leather"], categories: ["upholstery", "finish"], unit: "sqm" },
      { id: "soft-wood", labelKey: "material.wood", types: ["wood"], categories: ["frame"], unit: "sqm" },
      { id: "soft-metal", labelKey: "material.metal", types: ["metal"], categories: ["frame"], unit: "meter" },
    ],
  },
];

function buildingProductDefaults(value: string): Pick<MaterialProductChoice, "types" | "categories" | "unit" | "floorLayoutPattern"> {
  if (value.startsWith("building-door-")) {
    const type = value.includes("mdf")
      ? "mdf"
      : value.includes("laminate")
        ? "laminate"
        : value.includes("metal") || value.includes("security")
          ? "metal"
          : "wood";
    return { types: [type], categories: [value, "door"], unit: "piece" };
  }

  if (value.startsWith("building-window-") || value.startsWith("building-glass-") || value === "building-balcony-door") {
    const type = value.includes("pvc")
      ? "plastic"
      : value.includes("aluminum")
        ? "metal"
        : value.includes("wood")
          ? "wood"
          : "glass";
    return { types: [type], categories: [value], unit: "piece" };
  }

  if (value.startsWith("building-flooring-")) {
    const type =
      value.includes("laminate")
        ? "laminate"
        : value.includes("parquet") || value.includes("hardwood")
          ? "wood"
          : value.includes("vinyl")
            ? "plastic"
            : value.includes("ceramic") || value.includes("porcelain")
              ? "stone"
              : "plastic";
    return {
      types: [type],
      categories: [value, "floor", "finish"],
      unit: "sqm",
      floorLayoutPattern: "aligned",
    };
  }

  if (value.startsWith("building-wall-")) {
    const type = value.includes("wallpaper")
      ? "paper"
      : value.includes("wood")
        ? "wood"
        : value.includes("tiles")
          ? "stone"
          : "plastic";
    return { types: [type], categories: [value, "finish"], unit: value.includes("wallpaper") ? "roll" : "sqm" };
  }

  if (value.startsWith("building-ceiling-")) {
    const type = value.includes("stretch")
      ? "fabric"
      : value.includes("suspended")
        ? "metal"
        : "plastic";
    return { types: [type], categories: [value, "finish"], unit: "sqm" };
  }

  return { types: ["plastic"], categories: [value], unit: "sqm" };
}

function sortManufacturerSlugs(slugs: string[]): string[] {
  const orderIdx = new Map(BRAND_DISPLAY_ORDER.map((k, i) => [k, i]));
  return [...new Set(slugs)].sort((a, b) => {
    const ia = orderIdx.has(a) ? orderIdx.get(a)! : 1000;
    const ib = orderIdx.has(b) ? orderIdx.get(b)! : 1000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

function sortBrandKeys(keys: string[]): string[] {
  const custom = keys.filter((k) => k === "__custom__");
  const rest = sortManufacturerSlugs(keys.filter((k) => k !== "__custom__"));
  return [...rest, ...custom];
}

function groupKey(typeKey: string, brandKey: string): string {
  return `${typeKey}::${brandKey}`;
}

function templateCategorySlugs(t: MaterialTemplate): string[] {
  if (t.categories?.length) return t.categories;
  return t.category ? [t.category] : [];
}

/**
 * Brand bucket in the default catalog: Domus resale of another OEM uses categories that
 * include `domus` while manufacturer stays the source brand → `domus-egger`, etc.
 */
function catalogTemplateBrandKey(t: MaterialTemplate): string {
  const m = (t.manufacturer || "").trim().toLowerCase();
  if (!m) return "__custom__";
  const slugs = templateCategorySlugs(t);
  if (slugs.includes("domus") && m !== "domus") {
    return `domus-${m}`;
  }
  return m;
}

function materialMfrChipLabel(key: string, translate: (k: string) => string): string {
  if (key.startsWith("domus-")) {
    const sub = key.slice("domus-".length);
    const domus = translate("materials.mfr.domus");
    if (!sub) return domus;
    return `${domus} · ${materialMfrChipLabel(sub, translate)}`;
  }
  const tr = translate(`materials.mfr.${key}`);
  return tr !== `materials.mfr.${key}` ? tr : key.charAt(0).toUpperCase() + key.slice(1);
}

/** Picks one section heading for lists when a material has multiple `types`. */
function primaryTypeForGrouping(m: Pick<Material, "type" | "types">, order: string[]): string {
  const slugs = m.types?.length ? m.types : [m.type];
  for (const o of order) {
    if (slugs.includes(o)) return o;
  }
  return slugs[0] ?? m.type;
}

const CATALOG_TYPE_ICON: Record<string, LucideIcon> = {
  laminate: Layers,
  mdf: PanelsTopLeft,
  wood: TreePine,
  worktop: Sandwich,
  slide: ChevronsLeftRight,
  hinge: ChevronsLeftRight,
};

export default function MaterialsPage() {
  const { t } = useTranslation();
  const {
    materials,
    materialTemplates,
    modes,
    fetchMaterials,
    fetchModes,
    fetchMaterialTemplates,
    importMaterialTemplates,
    bulkUpdateMaterials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    currentUser,
  } = useStore();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    types: ["laminate"] as string[],
    categories: [] as string[],
    subModeId: "",
    color: "",
    colorCode: "",
    price: "",
    currency: currentUser?.currency || "AMD",
    unit: "sqm",
    imageUrl: "",
    // Sheet metadata — only persisted for laminate / MDF / wood / worktop types.
    // Blank strings mean "use default" (360 × 180 cm, 3 mm kerf).
    sheetWidthCm: "",
    sheetHeightCm: "",
    grainDirection: "along_width" as MaterialGrainDirection,
    kerfMm: "",
    textureWidthCm: "",
    textureHeightCm: "",
    productWidthCm: "",
    productHeightCm: "",
    floorLayoutPattern: "aligned" as FloorLayoutPattern,
  });

  /** Tabs for the image source selector in the form. */
  const [imageSourceTab, setImageSourceTab] = useState<"upload" | "url">("url");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadTooLargeOpen, setUploadTooLargeOpen] = useState(false);
  /** Yellow/non-blocking warnings about the provided image (resolution / aspect). */
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [materialFormError, setMaterialFormError] = useState<string | null>(null);
  const [advancedClassificationOpen, setAdvancedClassificationOpen] = useState(false);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCurrency, setBulkCurrency] = useState(currentUser?.currency || "AMD");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [catalogMaterialType, setCatalogMaterialType] = useState("");
  const [catalogManufacturer, setCatalogManufacturer] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFetching, setCatalogFetching] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [importModeId, setImportModeId] = useState("");
  const [catalogImportPrice, setCatalogImportPrice] = useState("");
  const [catalogImportCurrency, setCatalogImportCurrency] = useState(
    currentUser?.currency || "AMD",
  );
  const [catalogImportBusy, setCatalogImportBusy] = useState(false);
  /** Lazy-load catalog API + decors until the user opens this block. */
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  /** Visible row count per type×brand group for "My materials". */
  const [groupVisibleCount, setGroupVisibleCount] = useState<Record<string, number>>({});
  /** Visible decor count per manufacturer within the catalog grid. */
  const [catalogBrandVisibleCount, setCatalogBrandVisibleCount] = useState<Record<string, number>>({});

  const materialTypes = useMemo(() => [
    { value: "laminate", label: t("material.laminate") },
    { value: "mdf", label: t("material.mdf") },
    { value: "wood", label: t("material.wood") },
    { value: "worktop", label: t("material.worktop") },
    { value: "slide", label: t("material.slide") },
    { value: "hinge", label: t("material.hinge") },
    { value: "handle", label: t("material.handle") },
    { value: "metal", label: t("material.metal") },
    { value: "fabric", label: t("material.fabric") },
    { value: "paper", label: t("material.paper") },
    { value: "boucle", label: t("material.boucle") },
    { value: "leather", label: t("material.leather") },
    { value: "glass", label: t("material.glass") },
    { value: "plastic", label: t("material.plastic") },
    { value: "stone", label: t("material.stone") },
  ], [t]);

  const materialCategories = useMemo(() => [
    { value: "frame", label: t("material.frame") },
    { value: "surface", label: t("material.surface") },
    { value: "door", label: t("material.door") },
    { value: "hardware", label: t("material.hardware") },
    { value: "upholstery", label: t("material.upholstery") },
    { value: "finish", label: t("material.finish") },
    { value: "worktop", label: t("material.worktop") },
    { value: "domus", label: t("material.domus") },
  ], [t]);

  const categoryLabel = useCallback((slug: string): string => {
    for (const g of BUILDING_MATERIAL_CATEGORY_GROUPS) {
      const it = g.items.find((i) => i.value === slug);
      if (it) return t(it.labelKey);
    }
    return materialCategories.find((c) => c.value === slug)?.label ?? slug;
  }, [materialCategories, t]);

  const units = [
    { value: "sqm", label: t("unit.sqm") },
    { value: "meter", label: t("unit.meter") },
    { value: "piece", label: t("unit.piece") },
    { value: "roll", label: t("unit.roll") },
    { value: "box", label: t("unit.box") },
    { value: "kg", label: t("unit.kg") },
  ];

  const selectedModeIdForProducts =
    currentUser?.selectedModeId?.trim() || modes[0]?.id || "mode-furniture";
  const selectedSubModeIds = useMemo(
    () => currentUser?.selectedSubModeIds ?? [],
    [currentUser?.selectedSubModeIds],
  );
  const selectedSubModeIdSet = useMemo(
    () => new Set(selectedSubModeIds),
    [selectedSubModeIds],
  );
  const selectedMode = modes.find((m) => m.id === selectedModeIdForProducts);
  const selectedModeSubModeIds = selectedMode?.subModes.map((sm) => sm.id) ?? [];
  const fallbackSubModeId = selectedSubModeIds[0] ?? selectedModeSubModeIds[0] ?? "";

  const visibleProductGroups = useMemo<MaterialProductGroup[]>(() => {
    const mapBuildingCategoriesToGroups = (): MaterialProductGroup[] => {
      const hasSubModeFilter = selectedSubModeIdSet.size > 0;
      return BUILDING_MATERIAL_CATEGORY_GROUPS
        .filter((group) => !hasSubModeFilter || selectedSubModeIdSet.has(group.subModeId))
        .map((group) => ({
          id: group.subModeId,
          labelKey: group.groupLabelKey,
          descriptionKey: "materials.productGroup.buildingDesc",
          choices: group.items.map((item) => ({
            id: item.value,
            labelKey: item.labelKey,
            subModeId: group.subModeId,
            ...buildingProductDefaults(item.value),
          })),
        }));
    };

    const groups: MaterialProductGroup[] = [];

    const mapSoftProductGroups = (): MaterialProductGroup[] => {
      const softSub =
        selectedSubModeIds.find((id) => SOFT_FURNITURE_SUBMODE_IDS.has(id)) ||
        fallbackSubModeId ||
        "";
      return SOFT_FURNITURE_PRODUCT_GROUPS.map((group) => ({
        ...group,
        choices: group.choices.map((choice) => ({
          ...choice,
          subModeId: softSub || undefined,
        })),
      }));
    };

    if (selectedModeIdForProducts === "mode-furniture") {
      groups.push(
        ...FURNITURE_PRODUCT_GROUPS.map((group) => ({
          ...group,
          choices: group.choices.map((choice) => ({
            ...choice,
            subModeId: fallbackSubModeId || undefined,
          })),
        })),
      );
    }

    const wantsSoftFurnitureProductRows = [...selectedSubModeIdSet].some((id) =>
      SOFT_FURNITURE_SUBMODE_IDS.has(id),
    );
    if (selectedModeIdForProducts === "mode-soft-furniture" || wantsSoftFurnitureProductRows) {
      groups.push(...mapSoftProductGroups());
    }

    if (selectedModeIdForProducts === "mode-building-materials") {
      groups.push(...mapBuildingCategoriesToGroups());
    }

    /**
     * `selectMode` sets `selectedModeId` to the first mode in the API list that has any
     * selected sub-mode. Merchants often enable mixed sub-categories; then primary mode
     * may stay `mode-furniture` while soft-furniture or building sub-modes are also on.
     * Merge in building product rows whenever a building-material sub-mode is enabled.
     * Merge in soft-furniture product rows whenever a soft-furniture sub-mode is enabled.
     */
    const wantsBuildingProductRows = [...selectedSubModeIdSet].some((id) =>
      BUILDING_MATERIAL_SUBMODE_IDS.has(id),
    );
    if (wantsBuildingProductRows && selectedModeIdForProducts !== "mode-building-materials") {
      groups.push(...mapBuildingCategoriesToGroups());
    }

    return groups;
  }, [fallbackSubModeId, selectedModeIdForProducts, selectedSubModeIdSet, selectedSubModeIds]);

  const selectedProductChoice = useMemo(() => {
    for (const group of visibleProductGroups) {
      const choice = group.choices.find((item) =>
        item.types.every((type) => formData.types.includes(type)) &&
        item.categories.every((category) => formData.categories.includes(category)),
      );
      if (choice) return choice;
    }
    return null;
  }, [formData.categories, formData.types, visibleProductGroups]);

  const selectedProductLabel = selectedProductChoice ? t(selectedProductChoice.labelKey) : "";

  const internalTypeSummary = useMemo(
    () =>
      formData.types
        .map((type) => materialTypes.find((opt) => opt.value === type)?.label ?? type)
        .join(", "),
    [formData.types, materialTypes],
  );

  const internalCategorySummary = useMemo(
    () => formData.categories.map((category) => categoryLabel(category)).join(", "),
    [categoryLabel, formData.categories],
  );

  const overrideCategoryOptions = useMemo(() => {
    const allBuildingItems = BUILDING_MATERIAL_CATEGORY_GROUPS.flatMap((group) => group.items);
    const relevantCategoryValues = new Set<string>();
    for (const group of visibleProductGroups) {
      for (const choice of group.choices) {
        for (const category of choice.categories) relevantCategoryValues.add(category);
      }
    }
    for (const category of formData.categories) relevantCategoryValues.add(category);

    const byValue = new Map<string, { value: string; label: string }>();
    for (const category of materialCategories) {
      byValue.set(category.value, category);
    }
    for (const item of allBuildingItems) {
      if (relevantCategoryValues.has(item.value)) {
        byValue.set(item.value, { value: item.value, label: t(item.labelKey) });
      }
    }
    for (const category of formData.categories) {
      if (!byValue.has(category)) {
        byValue.set(category, { value: category, label: categoryLabel(category) });
      }
    }

    return Array.from(byValue.values());
  }, [categoryLabel, formData.categories, materialCategories, t, visibleProductGroups]);

  const applyProductChoice = (choice: MaterialProductChoice) => {
    setFormData((p) => ({
      ...p,
      types: choice.types,
      categories: choice.categories,
      unit: choice.unit,
      subModeId: choice.subModeId ?? fallbackSubModeId,
      floorLayoutPattern: choice.floorLayoutPattern ?? p.floorLayoutPattern,
    }));
  };

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    void fetchModes();
  }, [fetchModes]);

  useEffect(() => {
    if (!catalogExpanded) return;
    let cancelled = false;
    setCatalogFetching(true);
    const params = catalogMaterialType ? { type: catalogMaterialType } : undefined;
    void fetchMaterialTemplates(params).finally(() => {
      if (!cancelled) setCatalogFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [catalogExpanded, catalogMaterialType, fetchMaterialTemplates]);

  useEffect(() => {
    setCatalogManufacturer("");
    setSelectedTemplateIds([]);
  }, [catalogMaterialType]);

  useEffect(() => {
    const mid = currentUser?.selectedModeId || "";
    if (mid) setImportModeId(mid);
  }, [currentUser?.selectedModeId]);

  useEffect(() => {
    if (currentUser?.currency) {
      setBulkCurrency(currentUser.currency);
      setCatalogImportCurrency(currentUser.currency);
    }
  }, [currentUser?.currency]);

  useEffect(() => {
    setSelectedTemplateIds([]);
  }, [catalogManufacturer]);

  useEffect(() => {
    setCatalogBrandVisibleCount({});
  }, [catalogMaterialType, catalogManufacturer, catalogSearch]);

  useEffect(() => {
    setGroupVisibleCount({});
  }, [search]);

  const q = search.trim().toLowerCase();
  const filteredMaterials = materials.filter((m) => {
    if (!q) return true;
    const catStr = (m.categories?.length ? m.categories : [m.category])
      .join(" ")
      .toLowerCase();
    const typeQ = (m.types?.length ? m.types : [m.type]).join(" ").toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      typeQ.includes(q) ||
      catStr.includes(q) ||
      (m.color || "").toLowerCase().includes(q)
    );
  });

  const typeOrderIndex = useMemo(
    () => new Map(MATERIAL_TYPE_ORDER.map((v, i) => [v, i])),
    []
  );

  const materialsByTypeAndBrand = useMemo(() => {
    const typeMap = new Map<string, Map<string, Material[]>>();
    for (const m of filteredMaterials) {
      const typeKey = primaryTypeForGrouping(m, MATERIAL_TYPE_ORDER);
      const raw = m.manufacturer?.trim();
      const brandKey = raw ? raw.toLowerCase() : "__custom__";
      if (!typeMap.has(typeKey)) typeMap.set(typeKey, new Map());
      const brandMap = typeMap.get(typeKey)!;
      if (!brandMap.has(brandKey)) brandMap.set(brandKey, []);
      brandMap.get(brandKey)!.push(m);
    }
    const rows: {
      typeKey: string;
      brands: { brandKey: string; items: Material[] }[];
    }[] = [];
    for (const [typeKey, brandMap] of typeMap) {
      const brandKeys = sortBrandKeys([...brandMap.keys()]);
      const brands = brandKeys.map((bk) => ({
        brandKey: bk,
        items: brandMap.get(bk)!,
      }));
      rows.push({ typeKey, brands });
    }
    rows.sort((a, b) => {
      const ia = typeOrderIndex.get(a.typeKey) ?? 1000;
      const ib = typeOrderIndex.get(b.typeKey) ?? 1000;
      if (ia !== ib) return ia - ib;
      return a.typeKey.localeCompare(b.typeKey);
    });
    return rows;
  }, [filteredMaterials, typeOrderIndex]);

  const manufacturerOptions = useMemo(() => {
    const uniq = new Set(materialTemplates.map((x) => catalogTemplateBrandKey(x)));
    return sortManufacturerSlugs([...uniq]);
  }, [materialTemplates]);

  const catalogTypeChoices = useMemo(() => {
    return MATERIAL_TYPE_ORDER.map((value) => {
      const found = materialTypes.find((x) => x.value === value);
      return found ? { value, label: found.label } : null;
    }).filter((x): x is { value: string; label: string } => x !== null);
  }, [materialTypes]);

  const catalogQ = catalogSearch.trim().toLowerCase();
  const filteredTemplates = useMemo(() => {
    let list = materialTemplates;
    if (catalogManufacturer) {
      list = list.filter((x) => catalogTemplateBrandKey(x) === catalogManufacturer);
    }
    if (catalogQ) {
      list = list.filter(
        (x) =>
          x.name.toLowerCase().includes(catalogQ) ||
          (x.externalCode?.toLowerCase().includes(catalogQ) ?? false) ||
          x.color.toLowerCase().includes(catalogQ),
      );
    }
    return list;
  }, [materialTemplates, catalogManufacturer, catalogQ]);

  const catalogTemplatesByBrand = useMemo(() => {
    const brandMap = new Map<string, MaterialTemplate[]>();
    for (const tmpl of filteredTemplates) {
      const bk = catalogTemplateBrandKey(tmpl);
      if (!brandMap.has(bk)) brandMap.set(bk, []);
      brandMap.get(bk)!.push(tmpl);
    }
    const keys = sortBrandKeys([...brandMap.keys()]);
    return keys.map((brandKey) => ({
      brandKey,
      items: brandMap.get(brandKey)!,
    }));
  }, [filteredTemplates]);

  const mfrLabel = (key: string) => materialMfrChipLabel(key, t);

  const brandSectionLabel = (brandKey: string) =>
    brandKey === "__custom__" ? t("materials.brandCustom") : mfrLabel(brandKey);

  const hasFloorMaterialCategory = formData.categories.some(
    (category) => category.startsWith(FLOORING_CATEGORY_PREFIX) || category === "floor",
  );
  const hasWallMaterialCategory = formData.categories.some((category) =>
    category.startsWith(WALL_CATEGORY_PREFIX),
  );
  const hasWallpaperCategory = formData.categories.includes(WALLPAPER_CATEGORY);
  const hasPlannerPhysicalSizeCategory = hasFloorMaterialCategory || hasWallMaterialCategory;
  const physicalSizeCopy = hasWallpaperCategory
    ? {
        title: "Texture repeat size",
        description:
          "Optional. Enter the real area represented by one wallpaper image repeat. This keeps the texture scale correct in the planner, not the uploaded image pixel size.",
        widthLabel: "Image repeat width (cm)",
        heightLabel: "Image repeat height (cm)",
        widthPlaceholder: "e.g. 53",
        heightPlaceholder: "e.g. 100",
      }
    : hasWallMaterialCategory
      ? {
          title: "Texture repeat size",
          description:
            "Optional. Enter the real tile, panel, or texture repeat size represented by the image. This is used only for planner texture scale.",
          widthLabel: "Image repeat width (cm)",
          heightLabel: "Image repeat height (cm)",
          widthPlaceholder: "e.g. 30",
          heightPlaceholder: "e.g. 60",
        }
      : {
          title: "Texture repeat size",
          description:
            "Optional. Enter the real plank, tile, board, or texture repeat size represented by the image. This is used only for planner texture scale.",
          widthLabel: "Image repeat width (cm)",
          heightLabel: "Image repeat height (cm)",
          widthPlaceholder: "e.g. 20",
          heightPlaceholder: "e.g. 120",
        };
  const productSizeCopy = hasWallpaperCategory
    ? {
        title: "Sellable roll size / coverage",
        description:
          "Optional. Enter the actual wallpaper roll coverage sold for the entered price. The published planner uses this to calculate roll count and total price.",
        widthLabel: "Roll width (cm)",
        heightLabel: "Roll length (cm)",
        widthPlaceholder: "e.g. 53",
        heightPlaceholder: "e.g. 1000",
      }
    : hasWallMaterialCategory
      ? {
          title: "Sellable item size / coverage",
          description:
            "Optional. Enter the actual panel, tile pack, or item coverage sold for the entered price. The published planner uses this for item count and total price.",
          widthLabel: "Item/pack width (cm)",
          heightLabel: "Item/pack height (cm)",
          widthPlaceholder: "e.g. 30",
          heightPlaceholder: "e.g. 60",
        }
      : {
          title: "Sellable item size / coverage",
          description:
            "Optional. Enter the actual board, tile pack, laminate box, or item coverage sold for the entered price. The published planner uses this for item count and total price.",
          widthLabel: "Item/pack width (cm)",
          heightLabel: "Item/pack length (cm)",
          widthPlaceholder: "e.g. 120",
          heightPlaceholder: "e.g. 200",
        };

  const getGroupVisible = (typeKey: string, brandKey: string, total: number) => {
    const k = groupKey(typeKey, brandKey);
    return Math.min(groupVisibleCount[k] ?? GROUP_PAGE_SIZE, total);
  };

  const bumpGroupVisible = (typeKey: string, brandKey: string, total: number) => {
    const k = groupKey(typeKey, brandKey);
    setGroupVisibleCount((prev) => ({
      ...prev,
      [k]: Math.min(total, (prev[k] ?? GROUP_PAGE_SIZE) + GROUP_PAGE_SIZE),
    }));
  };

  const getCatalogBrandVisible = (brandKey: string, total: number) =>
    Math.min(catalogBrandVisibleCount[brandKey] ?? GROUP_PAGE_SIZE, total);

  const bumpCatalogBrandVisible = (brandKey: string, total: number) => {
    setCatalogBrandVisibleCount((prev) => ({
      ...prev,
      [brandKey]: Math.min(total, (prev[brandKey] ?? GROUP_PAGE_SIZE) + GROUP_PAGE_SIZE),
    }));
  };

  const resolvedModeIdForMaterial =
    currentUser?.selectedModeId?.trim() || modes[0]?.id || "";

  const resetForm = () => {
    setMaterialFormError(null);
    setFormData({
      name: "",
      types: ["laminate"],
      categories: [],
      subModeId: "",
      color: "",
      colorCode: "",
      price: "",
      currency: currentUser?.currency || "AMD",
      unit: "sqm",
      imageUrl: "",
      sheetWidthCm: "",
      sheetHeightCm: "",
      grainDirection: "along_width",
      kerfMm: "",
      textureWidthCm: "",
      textureHeightCm: "",
      productWidthCm: "",
      productHeightCm: "",
      floorLayoutPattern: "aligned",
    });
    setImageSourceTab("url");
    setImageUploading(false);
    setImageError(null);
    setImageWarnings([]);
    setImageDimensions(null);
    setAdvancedClassificationOpen(false);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (material: typeof materials[0]) => {
    setFormData({
      name: material.name,
      types: material.types?.length ? [...material.types] : [material.type],
      categories:
        material.categories?.length ? [...material.categories] : [material.category],
      subModeId: material.subModeId ?? "",
      color: material.color || "",
      colorCode: material.colorCode || "",
      price: material.price.toString(),
      currency: material.currency,
      unit: material.unit,
      imageUrl: material.imageUrl || "",
      sheetWidthCm:
        material.sheetWidthCm !== undefined && material.sheetWidthCm !== null
          ? String(material.sheetWidthCm)
          : "",
      sheetHeightCm:
        material.sheetHeightCm !== undefined && material.sheetHeightCm !== null
          ? String(material.sheetHeightCm)
          : "",
      grainDirection: material.grainDirection ?? "along_width",
      kerfMm:
        material.kerfMm !== undefined && material.kerfMm !== null
          ? String(material.kerfMm)
          : "",
      textureWidthCm:
        material.textureWidthCm !== undefined && material.textureWidthCm !== null
          ? String(material.textureWidthCm)
          : "",
      textureHeightCm:
        material.textureHeightCm !== undefined && material.textureHeightCm !== null
          ? String(material.textureHeightCm)
          : "",
      productWidthCm:
        material.productWidthCm !== undefined && material.productWidthCm !== null
          ? String(material.productWidthCm)
          : "",
      productHeightCm:
        material.productHeightCm !== undefined && material.productHeightCm !== null
          ? String(material.productHeightCm)
          : "",
      floorLayoutPattern: material.floorLayoutPattern ?? "aligned",
    });
    setImageSourceTab(material.imageUrl ? "url" : "url");
    setImageError(null);
    setImageWarnings([]);
    setImageDimensions(null);
    setAdvancedClassificationOpen(false);
    setEditingId(material.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaterialFormError(null);
    if (formData.categories.length === 0 || formData.types.length === 0) return;

    if (!resolvedModeIdForMaterial) {
      setMaterialFormError(t("materials.modeRequiredForMaterial"));
      return;
    }

    const price = parseFloat(formData.price) || 0;

    // Sheet fields only apply when any selected type is sheet stock;
    // stay undefined otherwise so backend treats them as "not provided".
    const sheeted = isSheetedMaterialFromTypes(formData.types);
    const parseOpt = (s: string): number | undefined => {
      if (!sheeted) return undefined;
      const trimmed = s.trim();
      if (trimmed === "") return undefined;
      const n = Number(trimmed);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const parseTextureOpt = (s: string): number | null => {
      const trimmed = s.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const data = {
      name: formData.name.trim(),
      type: formData.types[0],
      types: formData.types,
      categories: formData.categories,
      category: formData.categories[0] ?? "",
      subModeId: formData.subModeId || fallbackSubModeId || undefined,
      color: formData.color.trim(),
      colorCode: formData.colorCode.trim(),
      colorHex: formData.colorCode.trim(),
      price,
      pricePerUnit: price,
      currency: formData.currency,
      unit: formData.unit,
      imageUrl: formData.imageUrl || undefined,
      sheetWidthCm: parseOpt(formData.sheetWidthCm),
      sheetHeightCm: parseOpt(formData.sheetHeightCm),
      grainDirection: sheeted ? formData.grainDirection : undefined,
      kerfMm: parseOpt(formData.kerfMm),
      textureWidthCm: hasPlannerPhysicalSizeCategory
        ? parseTextureOpt(formData.textureWidthCm)
        : null,
      textureHeightCm: hasPlannerPhysicalSizeCategory
        ? parseTextureOpt(formData.textureHeightCm)
        : null,
      productWidthCm: hasPlannerPhysicalSizeCategory
        ? parseTextureOpt(formData.productWidthCm)
        : null,
      productHeightCm: hasPlannerPhysicalSizeCategory
        ? parseTextureOpt(formData.productHeightCm)
        : null,
      floorLayoutPattern: hasFloorMaterialCategory ? formData.floorLayoutPattern : null,
      modeId: resolvedModeIdForMaterial,
      isActive: true,
    };

    try {
      if (editingId) {
        await updateMaterial(editingId, data);
      } else {
        await addMaterial(data);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      setMaterialFormError(msg || t("materials.saveFailed"));
    }
  };

  /**
   * Probes an image URL to flag potential quality issues:
   *  - resolution below ~8 px/cm along the sheet's long edge (blurry closeups)
   *  - aspect ratio >5% off from the declared sheet aspect (pattern distortion)
   */
  const probeImageQuality = (url: string) => {
    if (!url) {
      setImageWarnings([]);
      setImageDimensions(null);
      return;
    }
    if (typeof window === "undefined") return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      const notes: string[] = [];
      if (isSheetedMaterialFromTypes(formData.types)) {
        const sheetW =
          Number(formData.sheetWidthCm) > 0
            ? Number(formData.sheetWidthCm)
            : DEFAULT_SHEET_WIDTH_CM;
        const sheetH =
          Number(formData.sheetHeightCm) > 0
            ? Number(formData.sheetHeightCm)
            : DEFAULT_SHEET_HEIGHT_CM;
        const longPx = Math.max(img.naturalWidth, img.naturalHeight);
        const longCm = Math.max(sheetW, sheetH);
        const pxPerCm = longPx / longCm;
        if (pxPerCm < 8) {
          notes.push(
            `Low resolution: ${pxPerCm.toFixed(1)} px/cm. Recommend at least 10 px/cm ` +
            `(≈ ${Math.round(longCm * 10)} px on the long edge) for sharp close-ups.`,
          );
        }
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const sheetAspect = sheetW / sheetH;
        const ratio = imgAspect / sheetAspect;
        if (ratio < 0.95 || ratio > 1.05) {
          notes.push(
            `Image aspect ${imgAspect.toFixed(2)} does not match sheet aspect ` +
            `${sheetAspect.toFixed(2)} — pattern will be stretched.`,
          );
        }
      }
      setImageWarnings(notes);
    };
    img.onerror = () => {
      setImageWarnings([]);
      setImageDimensions(null);
    };
    img.src = url;
  };

  const handleImageUpload = async (file: File) => {
    setImageError(null);
    if (isFileOverMaxUpload(file)) {
      setUploadTooLargeOpen(true);
      return;
    }
    setImageUploading(true);
    try {
      const res = await api.uploadMaterialImage(file);
      setFormData((p) => ({ ...p, imageUrl: res.url }));
      probeImageQuality(res.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isMaxUploadError(err) || isLikelyUploadSizeLimitMessage(msg)) {
        setUploadTooLargeOpen(true);
      } else {
        setImageError(msg || "Failed to upload image");
      }
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageSelectedForCrop = (file: File) => {
    setImageError(null);
    setCropFile(file);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMaterial(deleteId).catch(console.error);
      setDeleteId(null);
    }
  };

  const toggleMaterialSelected = (id: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleTemplateSelected = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllInTypeGroup = (items: Material[]) => {
    const ids = items.map((m) => m.id);
    const allOn = ids.every((id) => selectedMaterialIds.includes(id));
    if (allOn) {
      setSelectedMaterialIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedMaterialIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const handleBulkApply = async () => {
    if (selectedMaterialIds.length === 0) return;
    const n = parseFloat(bulkPrice);
    if (!Number.isFinite(n) || n < 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateMaterials({
        ids: selectedMaterialIds,
        pricePerUnit: n,
        price: n,
        currency: bulkCurrency,
      });
      setSelectedMaterialIds([]);
      setBulkPrice("");
    } catch (e) {
      console.error(e);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleCatalogImport = async () => {
    if (selectedTemplateIds.length === 0 || !importModeId) return;
    const n = parseFloat(catalogImportPrice);
    if (!Number.isFinite(n) || n < 0) return;
    setCatalogImportBusy(true);
    try {
      await importMaterialTemplates({
        templateIds: selectedTemplateIds,
        modeId: importModeId,
        pricePerUnit: n,
        currency: catalogImportCurrency,
      });
      setSelectedTemplateIds([]);
      setCatalogImportPrice("");
      void fetchMaterials();
    } catch (e) {
      console.error(e);
    } finally {
      setCatalogImportBusy(false);
    }
  };

  return (
    <div
      className={`space-y-6 ${selectedMaterialIds.length > 0 ? "pb-28" : ""}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("materials.title")}</h1>
            <p className="text-[var(--muted-foreground)]">
              {currentUser?.companyName
                ? `${t("materials.description")} — ${currentUser.companyName}`
                : t("materials.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("materials.addMaterial")}
            </Button>
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50">
          <div className="min-h-[100dvh] flex items-center justify-center p-4 box-border">
            <Card className="w-full max-w-2xl max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto overflow-x-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingId ? t("materials.editMaterial") : t("materials.addMaterial")}
              </CardTitle>
              <button onClick={resetForm}>
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {materialFormError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {materialFormError}
                  </p>
                )}
                <Input
                  label={t("catalog.itemName")}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                />

                <fieldset className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                  <legend className="px-2 text-sm font-medium">
                    {t("materials.productGroup.title")}
                  </legend>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("materials.productGroup.hint")}
                  </p>

                  {visibleProductGroups.length === 0 ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      {t("materials.productGroup.noneForMode")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {visibleProductGroups.map((group) => (
                        <div key={group.id}>
                          <div className="mb-2">
                            <div className="text-sm font-semibold">{t(group.labelKey)}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {t(group.descriptionKey)}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.choices.map((choice) => {
                              const checked =
                                choice.types.every((type) => formData.types.includes(type)) &&
                                choice.categories.every((category) =>
                                  formData.categories.includes(category),
                                );
                              return (
                                <label
                                  key={choice.id}
                                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] ${
                                    checked
                                      ? "border-[var(--primary)] bg-[var(--accent)]"
                                      : "border-[var(--input)]"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="material-product-choice"
                                    className="border-[var(--input)]"
                                    checked={checked}
                                    onChange={() => applyProductChoice(choice)}
                                  />
                                  <span className="text-sm">{t(choice.labelKey)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                    {selectedProductLabel ? (
                      <>
                        {t("materials.productGroup.selected")}{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {selectedProductLabel}
                        </span>
                      </>
                    ) : (
                      t("materials.productGroup.selectOne")
                    )}
                  </div>
                </fieldset>

                <section className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">
                        {t("materials.internalClassification")}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {t("materials.internalClassificationHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start text-xs font-medium text-[var(--primary)] hover:underline"
                      onClick={() => setAdvancedClassificationOpen((open) => !open)}
                    >
                      {advancedClassificationOpen
                        ? t("materials.hideInternalTags")
                        : t("materials.editInternalTags")}
                    </button>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 rounded-md bg-[var(--accent)]/50 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {t("materials.internalProduct")}
                      </dt>
                      <dd className="font-medium text-[var(--foreground)]">
                        {selectedProductLabel || t("materials.productGroup.selectOne")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {t("materials.internalType")}
                      </dt>
                      <dd className="font-medium text-[var(--foreground)]">
                        {internalTypeSummary || "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--muted-foreground)]">
                        {t("materials.internalTags")}
                      </dt>
                      <dd className="font-medium text-[var(--foreground)]">
                        {internalCategorySummary || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {t("materials.unit")}
                      </dt>
                      <dd className="font-medium text-[var(--foreground)]">
                        {units.find((unit) => unit.value === formData.unit)?.label ?? formData.unit}
                      </dd>
                    </div>
                  </dl>

                  {advancedClassificationOpen && (
                    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        {t("materials.internalOverrideWarning")}
                      </p>

                      {selectedModeSubModeIds.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium mb-1.5">
                            {t("materials.internalSubMode")}
                          </label>
                          <select
                            value={formData.subModeId || fallbackSubModeId}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, subModeId: e.target.value }))
                            }
                            className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                          >
                            {selectedMode?.subModes.map((subMode) => (
                              <option key={subMode.id} value={subMode.id}>
                                {subMode.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <fieldset>
                        <legend className="block text-sm font-medium mb-1.5">
                          {t("materials.type")}
                        </legend>
                        <div className="flex flex-wrap gap-2">
                          {materialTypes.map((opt) => {
                            const checked = formData.types.includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-[var(--input)]"
                                  checked={checked}
                                  onChange={() => {
                                    setFormData((p) => {
                                      const next = checked
                                        ? p.types.filter((type) => type !== opt.value)
                                        : [...p.types, opt.value];
                                      if (next.length === 0) return p;
                                      const onlyHardware = next.every(
                                        (type) =>
                                          type === "slide" ||
                                          type === "hinge" ||
                                          type === "handle",
                                      );
                                      return {
                                        ...p,
                                        types: next,
                                        unit: onlyHardware ? "piece" : p.unit,
                                      };
                                    });
                                  }}
                                />
                                <span className="text-sm">{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend className="block text-sm font-medium mb-1.5">
                          {t("materials.internalTags")}
                        </legend>
                        <div className="flex flex-wrap gap-2">
                          {overrideCategoryOptions.map((cat) => {
                            const checked = formData.categories.includes(cat.value);
                            return (
                              <label
                                key={cat.value}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-[var(--input)]"
                                  checked={checked}
                                  onChange={() => {
                                    setFormData((p) => {
                                      const next = checked
                                        ? p.categories.filter((category) => category !== cat.value)
                                        : [...p.categories, cat.value];
                                      return { ...p, categories: next };
                                    });
                                  }}
                                />
                                <span className="text-sm">{cat.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        {formData.categories.length === 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                            {t("materials.selectAtLeastOneCategory")}
                          </p>
                        )}
                      </fieldset>
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t("materials.colorName")}
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  />
                  <Input
                    label={t("materials.colorCode")}
                    placeholder="#000000"
                    value={formData.colorCode}
                    onChange={(e) => setFormData((p) => ({ ...p, colorCode: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("materials.imageUrl") || "Sheet image"}
                  </label>
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
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageSelectedForCrop(f);
                          e.target.value = "";
                        }}
                      />
                      <div
                        className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--input)] p-3 cursor-pointer hover:bg-[var(--accent)]"
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                      >
                        <Upload className="w-4 h-4 text-[var(--muted-foreground)]" />
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {imageUploading
                            ? "Uploading…"
                            : "Click to upload (JPG / PNG / WebP) — crop first; export must fit within the upload limit."}
                        </span>
                      </div>
                      {imageError && (
                        <p className="mt-1.5 text-xs text-red-500">{imageError}</p>
                      )}
                    </div>
                  ) : (
                    <Input
                      placeholder="https://example.com/swatch.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        setFormData((p) => ({ ...p, imageUrl: url }));
                        probeImageQuality(url);
                      }}
                    />
                  )}

                  {formData.imageUrl && (
                    <div className="mt-2 flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0">
                        <img
                          src={formData.imageUrl}
                          alt="Material preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                          onLoad={() => probeImageQuality(formData.imageUrl)}
                        />
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] break-all flex-1 space-y-1">
                        <p>{formData.imageUrl}</p>
                        {imageDimensions && (
                          <p>
                            Image pixel size: {imageDimensions.width} x {imageDimensions.height} px
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {imageWarnings.length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2.5">
                      {imageWarnings.map((w, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isSheetedMaterialFromTypes(formData.types) && (
                  <fieldset className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                    <legend className="px-2 text-sm font-medium">
                      Sheet size & grain
                    </legend>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Physical stock sheet used for cabinet cutting, not the uploaded
                      image size and not wallpaper/tile dimensions. Leave blank to use the default
                      {` ${DEFAULT_SHEET_WIDTH_CM} × ${DEFAULT_SHEET_HEIGHT_CM} cm`}.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Sheet width (cm)"
                        type="number"
                        step="0.1"
                        min="1"
                        max="600"
                        placeholder={String(DEFAULT_SHEET_WIDTH_CM)}
                        value={formData.sheetWidthCm}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, sheetWidthCm: e.target.value }));
                          probeImageQuality(formData.imageUrl);
                        }}
                      />
                      <Input
                        label="Sheet height (cm)"
                        type="number"
                        step="0.1"
                        min="1"
                        max="600"
                        placeholder={String(DEFAULT_SHEET_HEIGHT_CM)}
                        value={formData.sheetHeightCm}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, sheetHeightCm: e.target.value }));
                          probeImageQuality(formData.imageUrl);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          Grain direction
                        </label>
                        <select
                          value={formData.grainDirection}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              grainDirection: e.target.value as MaterialGrainDirection,
                            }))
                          }
                          className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                        >
                          <option value="along_width">
                            Along width (sheet long edge)
                          </option>
                          <option value="along_height">
                            Along height (sheet short edge)
                          </option>
                          <option value="none">No grain (rotate freely)</option>
                        </select>
                      </div>
                      <Input
                        label="Kerf (mm)"
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder={String(DEFAULT_KERF_MM)}
                        value={formData.kerfMm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, kerfMm: e.target.value }))
                        }
                      />
                    </div>
                  </fieldset>
                )}

                {hasPlannerPhysicalSizeCategory && (
                  <fieldset className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                    <legend className="px-2 text-sm font-medium">
                      {physicalSizeCopy.title}
                    </legend>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {physicalSizeCopy.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label={physicalSizeCopy.widthLabel}
                        type="number"
                        step="0.1"
                        min="1"
                        max="5000"
                        placeholder={physicalSizeCopy.widthPlaceholder}
                        value={formData.textureWidthCm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, textureWidthCm: e.target.value }))
                        }
                      />
                      <Input
                        label={physicalSizeCopy.heightLabel}
                        type="number"
                        step="0.1"
                        min="1"
                        max="5000"
                        placeholder={physicalSizeCopy.heightPlaceholder}
                        value={formData.textureHeightCm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, textureHeightCm: e.target.value }))
                        }
                      />
                      {hasFloorMaterialCategory && (
                        <div>
                          <label className="block text-sm font-medium mb-1.5">
                            Default floor layout
                          </label>
                          <select
                            value={formData.floorLayoutPattern}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                floorLayoutPattern: e.target.value as FloorLayoutPattern,
                              }))
                            }
                            className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                          >
                            <option value="aligned">Aligned grid</option>
                            <option value="staggered">Staggered joints</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </fieldset>
                )}

                {hasPlannerPhysicalSizeCategory && (
                  <fieldset className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                    <legend className="px-2 text-sm font-medium">
                      {productSizeCopy.title}
                    </legend>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {productSizeCopy.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={productSizeCopy.widthLabel}
                        type="number"
                        step="0.1"
                        min="1"
                        max="5000"
                        placeholder={productSizeCopy.widthPlaceholder}
                        value={formData.productWidthCm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, productWidthCm: e.target.value }))
                        }
                      />
                      <Input
                        label={productSizeCopy.heightLabel}
                        type="number"
                        step="0.1"
                        min="1"
                        max="5000"
                        placeholder={productSizeCopy.heightPlaceholder}
                        value={formData.productHeightCm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, productHeightCm: e.target.value }))
                        }
                      />
                    </div>
                  </fieldset>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {t("materials.unit")}
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                    >
                      {units.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={formData.categories.length === 0 || formData.types.length === 0}
                  >
                    {t("common.save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          </div>
        </div>
      )}

      {/* Materials list — grouped by material type, then brand */}
      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h3 className="font-medium mb-2">{t("materials.noMaterials")}</h3>
            <p className="text-[var(--muted-foreground)] mb-4">{t("materials.addFirst")}</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("materials.addMaterial")}
            </Button>
          </CardContent>
        </Card>
      ) : filteredMaterials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[var(--muted-foreground)]">{t("materials.noSearchResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {materialsByTypeAndBrand.map(({ typeKey, brands }) => {
            const typeLabel =
              materialTypes.find((x) => x.value === typeKey)?.label ?? typeKey;
            const allInType = brands.flatMap((b) => b.items);
            return (
              <section key={typeKey} aria-labelledby={`material-type-${typeKey}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-2 border-b border-[var(--border)]">
                  <h2
                    id={`material-type-${typeKey}`}
                    className="text-lg font-semibold text-[var(--foreground)]"
                  >
                    {typeLabel}
                    <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                      ({allInType.length})
                    </span>
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start sm:self-auto"
                    onClick={() => selectAllInTypeGroup(allInType)}
                  >
                    {t("materials.selectAllInSection")}
                  </Button>
                </div>
                <div className="space-y-8">
                  {brands.map(({ brandKey, items }) => {
                    const vis = getGroupVisible(typeKey, brandKey, items.length);
                    const shown = items.slice(0, vis);
                    const rest = items.length - shown.length;
                    return (
                      <div key={`${typeKey}-${brandKey}`} className="space-y-3">
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">
                          {brandSectionLabel(brandKey)}
                          <span className="ml-2 text-xs font-normal">
                            ({items.length})
                          </span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {shown.map((material) => (
                            <Card key={material.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleMaterialSelected(material.id)}
                                    className="mt-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0"
                                    aria-pressed={selectedMaterialIds.includes(material.id)}
                                  >
                                    {selectedMaterialIds.includes(material.id) ? (
                                      <CheckSquare className="w-5 h-5" />
                                    ) : (
                                      <Square className="w-5 h-5" />
                                    )}
                                  </button>
                                  <div
                                    className="w-12 h-12 rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0 bg-[var(--muted)]"
                                    style={{ backgroundColor: material.colorCode || undefined }}
                                  >
                                    {material.imageUrl && (
                                      <img
                                        src={material.imageUrl}
                                        alt=""
                                        width={48}
                                        height={48}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium">{material.name}</h3>
                                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                                      {(material.types?.length ? material.types : [material.type])
                                        .map(
                                          (slug) =>
                                            materialTypes.find((c) => c.value === slug)?.label ??
                                            slug,
                                        )
                                        .join(" · ")}
                                    </p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                      {(material.categories?.length
                                        ? material.categories
                                        : [material.category]
                                      )
                                        .map((slug) => categoryLabel(slug))
                                        .join(", ")}{" "}
                                      • {material.color}
                                    </p>
                                    <p className="text-sm font-medium text-[var(--primary)] mt-1">
                                      {formatPrice(material.price, material.currency)}{" "}
                                      {units.find((u) => u.value === material.unit)?.label}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEdit(material)}
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    {t("common.edit")}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(material.id)}
                                    className="text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        {rest > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => bumpGroupVisible(typeKey, brandKey, items.length)}
                          >
                            {t("materials.showMore").replace("{n}", String(rest))}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}


      <Card className="overflow-hidden border-[#F0E6D8] shadow-sm">
        <button
          type="button"
          onClick={() => setCatalogExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-[var(--muted)]/20 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Library className="w-5 h-5 text-[#C45F1A] shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t("materials.catalogSectionTitle")}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("materials.catalogSectionSubtitle")}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 shrink-0 text-[var(--muted-foreground)] transition-transform ${
              catalogExpanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        {catalogExpanded && (
        <div className="space-y-6 border-t border-[var(--border)] p-4 sm:p-6">
          <div className="relative overflow-hidden rounded-2xl border border-[#F0E6D8] bg-gradient-to-br from-[#FFFBF7] via-white to-[#F7F0E8] p-6 shadow-sm">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#E8772E]/[0.12] blur-3xl"
              aria-hidden
            />
            <div className="relative space-y-2 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#C45F1A]">
                {t("materials.tabCatalog")}
              </p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                {t("materials.catalogMotto")}
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {t("materials.catalogHint")}
              </p>
            </div>

            <div className="relative mt-8 space-y-3">
              <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                {t("materials.catalogStepMaterial")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => setCatalogMaterialType("")}
                  className={[
                    "group flex flex-col items-stretch rounded-xl border p-4 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8772E]/40",
                    !catalogMaterialType
                      ? "border-[#E8772E] bg-white shadow-md ring-2 ring-[#E8772E]/25"
                      : "border-[var(--border)] bg-white/80 hover:border-[#E8772E]/50 hover:shadow-sm",
                    "min-h-[88px]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors",
                        !catalogMaterialType
                          ? "bg-[#FEF3E7] text-[#C45F1A]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:bg-[#FEF3E7]/60 group-hover:text-[#C45F1A]",
                      ].join(" ")}
                    >
                      <Layers className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 text-sm font-semibold leading-snug">
                      {t("materials.catalogAllTypes")}
                    </span>
                  </div>
                </button>
                {catalogTypeChoices.map(({ value, label }) => {
                  const selected = catalogMaterialType === value;
                  const featured =
                    value === "laminate" ||
                    value === "mdf" ||
                    value === "wood" ||
                    value === "worktop";
                  const Icon = CATALOG_TYPE_ICON[value] ?? Layers;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCatalogMaterialType(value)}
                      className={[
                        "group flex flex-col items-stretch rounded-xl border p-4 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8772E]/40",
                        selected
                          ? "border-[#E8772E] bg-white shadow-md ring-2 ring-[#E8772E]/25"
                          : "border-[var(--border)] bg-white/80 hover:border-[#E8772E]/50 hover:shadow-sm",
                        featured ? "min-h-[100px]" : "min-h-[88px]",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors",
                            selected
                              ? "bg-[#FEF3E7] text-[#C45F1A]"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:bg-[#FEF3E7]/60 group-hover:text-[#C45F1A]",
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 text-sm font-semibold leading-snug">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-[var(--muted-foreground)] pt-2">
                {t("materials.catalogTypeOptionalHint")}
              </p>
            </div>
          </div>

          <Card className="overflow-hidden border-[#F0E6D8] shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    {t("materials.catalogStepBrand")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCatalogManufacturer("")}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium transition-all",
                        !catalogManufacturer
                          ? "bg-[#E8772E] text-white shadow-sm"
                          : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[#E8772E]/40",
                      ].join(" ")}
                    >
                      {t("materials.allManufacturers")}
                    </button>
                    {manufacturerOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCatalogManufacturer(m)}
                        className={[
                          "rounded-full px-4 py-2 text-sm font-medium transition-all",
                          catalogManufacturer === m
                            ? "bg-[#E8772E] text-white shadow-sm"
                            : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[#E8772E]/40",
                        ].join(" ")}
                      >
                        {mfrLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                  <Input
                    placeholder={t("common.search")}
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
                  <h3 className="text-sm font-semibold">{t("materials.catalogDecors")}</h3>
                  {catalogFetching && (
                    <span className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("materials.catalogLoading")}
                    </span>
                  )}
                </div>

                {catalogFetching ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-28 rounded-xl bg-gradient-to-r from-[var(--muted)]/80 to-[var(--muted)]/40 animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)] py-12 text-center">
                    {t("common.noResults")}
                  </p>
                ) : (
                  <div className="space-y-8">
                    {catalogTemplatesByBrand.map(({ brandKey, items }) => {
                      const vis = getCatalogBrandVisible(brandKey, items.length);
                      const shown = items.slice(0, vis);
                      const rest = items.length - shown.length;
                      return (
                        <div key={brandKey} className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">
                            {brandSectionLabel(brandKey)}
                            <span className="ml-2 normal-case font-normal text-[var(--muted-foreground)]">
                              ({items.length})
                            </span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {shown.map((tmpl) => {
                              const selected = selectedTemplateIds.includes(tmpl.id);
                              const swatch =
                                tmpl.colorHex && /^#[0-9A-Fa-f]{6}$/.test(tmpl.colorHex)
                                  ? tmpl.colorHex
                                  : "#f4f4f5";
                              return (
                                <Card
                                  key={tmpl.id}
                                  className={`overflow-hidden transition-shadow ${
                                    selected
                                      ? "ring-2 ring-[#E8772E] shadow-md"
                                      : "hover:shadow-md border-[var(--border)]"
                                  }`}
                                >
                                  <CardContent className="p-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleTemplateSelected(tmpl.id)}
                                      className="flex w-full text-left gap-3 p-3 rounded-lg"
                                    >
                                      <div className="pt-1 text-[var(--muted-foreground)] shrink-0">
                                        {selected ? (
                                          <CheckSquare className="w-5 h-5 text-[#E8772E]" />
                                        ) : (
                                          <Square className="w-5 h-5" />
                                        )}
                                      </div>
                                      <div
                                        className="w-12 h-12 rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0 shadow-inner bg-[var(--muted)]"
                                        style={{ backgroundColor: swatch }}
                                      >
                                        {tmpl.imageUrl && (
                                          <img
                                            src={tmpl.imageUrl}
                                            alt=""
                                            width={48}
                                            height={48}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h3 className="font-medium text-sm leading-snug">{tmpl.name}</h3>
                                        {tmpl.externalCode && (
                                          <p className="text-xs text-[var(--muted-foreground)] mt-1 font-mono">
                                            {tmpl.externalCode}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                          {rest > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => bumpCatalogBrandVisible(brandKey, items.length)}
                            >
                              {t("materials.showMore").replace("{n}", String(rest))}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 p-4 space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("materials.selectedCount").replace(
                      "{n}",
                      String(selectedTemplateIds.length),
                    )}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        {t("materials.importModeLabel")}
                      </label>
                      <select
                        value={importModeId}
                        onChange={(e) => setImportModeId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)]"
                      >
                        <option value="">
                          {modes.length ? "—" : t("materials.importNeedMode")}
                        </option>
                        {modes.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label={t("catalog.price")}
                        type="number"
                        step="0.01"
                        min="0"
                        value={catalogImportPrice}
                        onChange={(e) => setCatalogImportPrice(e.target.value)}
                      />
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          {t("catalog.currency")}
                        </label>
                        <select
                          value={catalogImportCurrency}
                          onChange={(e) => setCatalogImportCurrency(e.target.value)}
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
                  </div>
                  {!importModeId && modes.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {t("materials.importNeedMode")}
                    </p>
                  )}
                  <Button
                    type="button"
                    disabled={
                      catalogImportBusy ||
                      selectedTemplateIds.length === 0 ||
                      !importModeId ||
                      !Number.isFinite(parseFloat(catalogImportPrice)) ||
                      parseFloat(catalogImportPrice) < 0
                    }
                    onClick={() => void handleCatalogImport()}
                  >
                    {catalogImportBusy
                      ? t("materials.importing")
                      : t("materials.importSelected")}
                  </Button>
                </div>
              </CardContent>
            </Card>
        </div>
        )}
      </Card>

      {selectedMaterialIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-4">
            <p className="text-sm text-[var(--muted-foreground)] flex-1 min-w-[200px]">
              {t("materials.bulkBarHint")}{" "}
              <span className="font-medium text-[var(--foreground)]">
                {t("materials.selectedCount").replace(
                  "{n}",
                  String(selectedMaterialIds.length),
                )}
              </span>
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <Input
                label={t("materials.bulkPriceLabel")}
                type="number"
                step="0.01"
                min="0"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-36"
              />
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("catalog.currency")}
                </label>
                <select
                  value={bulkCurrency}
                  onChange={(e) => setBulkCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] min-w-[108px]"
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedMaterialIds([])}
              >
                {t("materials.clearSelection")}
              </Button>
              <Button
                type="button"
                disabled={
                  bulkBusy ||
                  !Number.isFinite(parseFloat(bulkPrice)) ||
                  parseFloat(bulkPrice) < 0
                }
                onClick={() => void handleBulkApply()}
              >
                {bulkBusy
                  ? t("materials.applyingBulk")
                  : t("materials.bulkApply").replace(
                      "{n}",
                      String(selectedMaterialIds.length),
                    )}
              </Button>
            </div>
          </div>
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
      <ImageCropDialog
        open={Boolean(cropFile)}
        files={cropFile ? [cropFile] : []}
        title="Crop material image"
        maxOutputBytes={MAX_UPLOAD_BYTES}
        onOutputTooLarge={() => setUploadTooLargeOpen(true)}
        onCancel={() => setCropFile(null)}
        onApply={(files) => {
          setCropFile(null);
          const file = files[0];
          if (file) void handleImageUpload(file);
        }}
      />
    </div>
  );
}
