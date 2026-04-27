/**
 * Subset of the published wardrobe planner types — keep in sync with
 * metrics_platform_published/src/app/planner/wardrobe/types.ts for JSON from orders.
 */

export type WardrobeComponentType =
  | "shelf"
  | "drawer"
  | "hanging-rod"
  | "pull-out-tray"
  | "shoe-rack"
  | "empty-section";

export interface WardrobeComponent {
  id: string;
  type: WardrobeComponentType;
  yPosition: number;
  height: number;
}

export interface WardrobeSection {
  id: string;
  width: number;
  components: WardrobeComponent[];
  /** Hinged doors — mirrors published planner */
  hingedDoorHandleSide?: "left" | "right";
}

export type DoorType = "none" | "hinged" | "sliding";

export interface WardrobeDoorConfig {
  type: DoorType;
  /** One finish per physical door panel for the current `type` (empty when `none`). */
  doorPanelMaterialIds: string[];
  /** Per-panel wood grain — same length as `doorPanelMaterialIds` when present. */
  doorPanelGrainDirections?: ("horizontal" | "vertical")[];
  slidingMechanismId: string;
  handle: string;
  /** @deprecated migrated to doorPanelMaterialIds */
  material?: string;
  /** @deprecated migrated to doorPanelMaterialIds */
  hingedMaterial?: string;
  /** @deprecated migrated to doorPanelMaterialIds */
  slidingMaterial?: string;
}

export interface WardrobeFrame {
  width: number;
  height: number;
  depth: number;
}

export type WardrobeBaseType = "floor" | "legs" | "plinth";

export interface WardrobeBaseConfig {
  type: WardrobeBaseType;
  legHeightCm: number;
  plinthHeightCm: number;
  plinthRecessCm: number;
}

export interface WardrobeConfig {
  frame: WardrobeFrame;
  base?: WardrobeBaseConfig;
  sections: WardrobeSection[];
  doors: WardrobeDoorConfig;
  frameMaterial: string;
  interiorMaterial: string;
}
