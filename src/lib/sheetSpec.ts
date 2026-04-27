/**
 * Admin-side mirror of the planner's sheet spec helper. Keep logic identical
 * to metrics_platform_published/src/app/planner/sheet/sheetSpec.ts so the
 * admin form preview matches what the planner will render (defaults 360×180 cm).
 *
 * Sheet stock: laminate (decor), MDF boards, wood, worktops — distinct from
 * hardware-only types (slides, hinges).
 */

import type { Material, MaterialGrainDirection } from "@/lib/types";

export const DEFAULT_SHEET_WIDTH_CM = 360;
export const DEFAULT_SHEET_HEIGHT_CM = 180;
export const DEFAULT_GRAIN_DIRECTION: MaterialGrainDirection = "along_width";
export const DEFAULT_KERF_MM = 3;

export interface SheetSpec {
  widthCm: number;
  heightCm: number;
  grainDirection: MaterialGrainDirection;
  kerfMm: number;
  kerfCm: number;
}

function positiveOrDefault(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function clampKerf(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_KERF_MM;
  return Math.min(n, 10);
}

export function getSheetSpec(
  material: Pick<
    Material,
    "sheetWidthCm" | "sheetHeightCm" | "grainDirection" | "kerfMm"
  > | null | undefined,
): SheetSpec {
  const widthCm = positiveOrDefault(material?.sheetWidthCm, DEFAULT_SHEET_WIDTH_CM);
  const heightCm = positiveOrDefault(material?.sheetHeightCm, DEFAULT_SHEET_HEIGHT_CM);
  const grainDirection: MaterialGrainDirection =
    material?.grainDirection === "along_width" ||
    material?.grainDirection === "along_height" ||
    material?.grainDirection === "none"
      ? material.grainDirection
      : DEFAULT_GRAIN_DIRECTION;
  const kerfMm = clampKerf(material?.kerfMm);
  return {
    widthCm,
    heightCm,
    grainDirection,
    kerfMm,
    kerfCm: kerfMm / 10,
  };
}

/** Sheet-stock types: decor laminate, MDF boards, solid/veneer wood, worktops. */
const SHEETED_MATERIAL_TYPES = new Set(["laminate", "mdf", "wood", "worktop"]);

export function isSheetedMaterialType(type: string | null | undefined): boolean {
  if (!type) return false;
  return SHEETED_MATERIAL_TYPES.has(type.toLowerCase());
}

/** All type slugs for a catalog row (multi-type aware). */
export function materialTypeSlugs(m: {
  type: string;
  types?: string[];
}): string[] {
  if (m.types?.length) return m.types;
  return [m.type];
}

/** True if any declared type uses sheet cutting (laminate, MDF, wood, worktop). */
export function isSheetedMaterialFromTypes(types: string[]): boolean {
  return types.some((t) => isSheetedMaterialType(t));
}

export function isSheetedMaterial(m: {
  type: string;
  types?: string[];
} | null | undefined): boolean {
  if (!m) return false;
  return isSheetedMaterialFromTypes(materialTypeSlugs(m));
}
