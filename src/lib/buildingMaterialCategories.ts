export interface BuildingMaterialCategoryItem {
  value: string;
  labelKey: string;
}

export interface BuildingMaterialCategoryGroup {
  groupLabelKey: string;
  subModeId: string;
  items: BuildingMaterialCategoryItem[];
}

export const BUILDING_MATERIAL_CATEGORY_GROUPS: BuildingMaterialCategoryGroup[] = [
  {
    groupLabelKey: "buildingMaterials.group.doors",
    subModeId: "sub-building-doors",
    items: [
      { value: "building-door-interior-wood", labelKey: "buildingMaterials.doors.interiorWood" },
      { value: "building-door-interior-mdf", labelKey: "buildingMaterials.doors.interiorMdf" },
      { value: "building-door-interior-laminate", labelKey: "buildingMaterials.doors.interiorLaminate" },
      { value: "building-door-exterior-metal", labelKey: "buildingMaterials.doors.exteriorMetal" },
      { value: "building-door-exterior-security", labelKey: "buildingMaterials.doors.exteriorSecurity" },
    ],
  },
  {
    groupLabelKey: "buildingMaterials.group.windowsGlazing",
    subModeId: "sub-building-windows-glazing",
    items: [
      { value: "building-window-pvc", labelKey: "buildingMaterials.windows.pvc" },
      { value: "building-window-aluminum", labelKey: "buildingMaterials.windows.aluminum" },
      { value: "building-window-wood", labelKey: "buildingMaterials.windows.wood" },
      { value: "building-balcony-door", labelKey: "buildingMaterials.windows.balconyDoor" },
      { value: "building-glass-double", labelKey: "buildingMaterials.glazing.double" },
      { value: "building-glass-tinted", labelKey: "buildingMaterials.glazing.tinted" },
      { value: "building-glass-low-e", labelKey: "buildingMaterials.glazing.lowE" },
    ],
  },
  {
    groupLabelKey: "buildingMaterials.group.flooring",
    subModeId: "sub-building-flooring",
    items: [
      { value: "building-flooring-laminate", labelKey: "buildingMaterials.flooring.laminate" },
      { value: "building-flooring-parquet-hardwood", labelKey: "buildingMaterials.flooring.parquetHardwood" },
      { value: "building-flooring-vinyl-lvt", labelKey: "buildingMaterials.flooring.vinylLvt" },
      { value: "building-flooring-vinyl-spc", labelKey: "buildingMaterials.flooring.vinylSpc" },
      { value: "building-flooring-ceramic", labelKey: "buildingMaterials.flooring.ceramic" },
      { value: "building-flooring-porcelain", labelKey: "buildingMaterials.flooring.porcelain" },
    ],
  },
  {
    groupLabelKey: "buildingMaterials.group.wallFinishes",
    subModeId: "sub-building-wall-finishes",
    items: [
      { value: "building-wall-paint", labelKey: "buildingMaterials.walls.paint" },
      { value: "building-wall-wallpaper", labelKey: "buildingMaterials.walls.wallpaper" },
      { value: "building-wall-panels-wood", labelKey: "buildingMaterials.walls.panelsWood" },
      { value: "building-wall-panels-pvc", labelKey: "buildingMaterials.walls.panelsPvc" },
      { value: "building-wall-panels-3d", labelKey: "buildingMaterials.walls.panels3d" },
      { value: "building-wall-tiles", labelKey: "buildingMaterials.walls.tiles" },
    ],
  },
  {
    groupLabelKey: "buildingMaterials.group.ceilingMaterials",
    subModeId: "sub-building-ceiling-materials",
    items: [
      { value: "building-ceiling-stretch", labelKey: "buildingMaterials.ceiling.stretch" },
      { value: "building-ceiling-gypsum", labelKey: "buildingMaterials.ceiling.gypsum" },
      { value: "building-ceiling-panels", labelKey: "buildingMaterials.ceiling.panels" },
      { value: "building-ceiling-suspended", labelKey: "buildingMaterials.ceiling.suspended" },
    ],
  },
  {
    groupLabelKey: "buildingMaterials.group.plinth",
    subModeId: "sub-building-plinth",
    items: [
      { value: "building-plinth-mdf", labelKey: "buildingMaterials.plinth.mdf" },
      { value: "building-plinth-pvc", labelKey: "buildingMaterials.plinth.pvc" },
      { value: "building-plinth-metal", labelKey: "buildingMaterials.plinth.metal" },
      { value: "building-plinth-stone", labelKey: "buildingMaterials.plinth.stone" },
    ],
  },
];

export const BUILDING_MATERIAL_CATEGORY_VALUES = new Set(
  BUILDING_MATERIAL_CATEGORY_GROUPS.flatMap((group) => group.items.map((item) => item.value)),
);

export interface SurfaceSubcategoryOption {
  value: string;
  label: string;
}

/** Subcategory choices shown when adding a catalog item for a surface sub-mode. */
export const SURFACE_SUBCATEGORY_OPTIONS: Record<string, SurfaceSubcategoryOption[]> = {
  "sub-building-flooring": [
    { value: "building-flooring-laminate", label: "Laminate" },
    { value: "building-flooring-parquet-hardwood", label: "Parquet / Hardwood" },
    { value: "building-flooring-vinyl-lvt", label: "Vinyl (LVT)" },
    { value: "building-flooring-vinyl-spc", label: "Vinyl (SPC)" },
    { value: "building-flooring-ceramic", label: "Tiles (floor) — ceramic" },
    { value: "building-flooring-porcelain", label: "Tiles (floor) — porcelain" },
    { value: "building-plinth", label: "Plinth / Skirting board" },
  ],
  "sub-building-wall-finishes": [
    { value: "building-wall-paint", label: "Paint colors" },
    { value: "building-wall-wallpaper", label: "Wallpapers" },
    { value: "building-wall-panels-wood", label: "Wall panels (wood, PVC, acoustic)" },
    { value: "building-wall-tiles", label: "Tiles (wall)" },
  ],
  "sub-building-ceiling-materials": [
    { value: "building-ceiling-stretch", label: "Stretch ceiling" },
    { value: "building-ceiling-gypsum", label: "Gypsum / plasterboard" },
    { value: "building-ceiling-panels", label: "Ceiling panels" },
    { value: "building-ceiling-suspended", label: "Suspended ceiling" },
  ],
  "sub-building-plinth": [
    { value: "building-plinth-mdf", label: "MDF / Wood plinth" },
    { value: "building-plinth-pvc", label: "PVC / Plastic plinth" },
    { value: "building-plinth-metal", label: "Metal / Aluminium plinth" },
    { value: "building-plinth-stone", label: "Stone / Ceramic plinth" },
  ],
};

/** All known surface subcategory slugs (used to detect/strip them from additionalCategories). */
export const ALL_SURFACE_SUBCATEGORY_VALUES = new Set(
  Object.values(SURFACE_SUBCATEGORY_OPTIONS).flat().map((o) => o.value),
);
