/**
 * Cut list for wardrobe laminate panels (mirror of published planner).
 * Keep in sync with metrics_platform_published/src/app/planner/wardrobe/laminateChart.ts
 */

import type { WardrobeConfig, WardrobeSection } from "./wardrobeLaminateTypes";

/** Match PANEL_THICKNESS in published data.ts */
const PANEL_THICKNESS = 1.8;

const CM = 0.01;
const T = PANEL_THICKNESS;
const DOOR_GAP_CM = 0.002 / CM;
const DOOR_THICKNESS_CM = 0.018 / CM;

/** Mirror `doorFrontExtraWidthCm` in published `data.ts`. */
function doorFrontExtraWidthCm(sectionIndex: number, sectionCount: number): number {
  const first = sectionIndex === 0;
  const last = sectionIndex === sectionCount - 1;
  return (first ? T : 0) + (last ? T : 0) - (first && last ? T : 0);
}

/** Mirror `doorFrontExtraHeightCm` in published `data.ts`. */
function doorFrontExtraHeightCm(reductionCm: number): { dhExtraCm: number; centerYShiftCm: number } {
  if (reductionCm <= 1e-9) {
    return { dhExtraCm: T, centerYShiftCm: 0 };
  }
  return { dhExtraCm: T / 2, centerYShiftCm: T / 4 };
}

/** Mirror `slidingDoorPanelWidthsCm` in published `data.ts` (sliding gap 0.6 mm). */
function slidingDoorPanelWidthsCm(frameWidthCm: number, doorCount: number) {
  const gap = 0.0006 / CM;
  const n = Math.max(2, doorCount);
  const spanW = frameWidthCm - 2 * gap;
  const overlap = spanW * 0.05;
  const doorW = (spanW + overlap * (n - 1)) / n;
  const slidePanelW = doorW - gap;
  return { slidePanelW };
}

export type LaminateCategory = "frame" | "interior" | "door" | "back";

export interface LaminateRow {
  label: string;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  qty: number;
  category: LaminateCategory;
  note?: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Mirror published `wardrobeDrawerBoxCutsCm` (WardrobeInterior3D drawer box). */
function wardrobeDrawerBoxCutsCm(
  sectionWidthCm: number,
  frameDepthCm: number,
  drawerHeightCm: number,
): {
  side: { widthCm: number; heightCm: number };
  back: { widthCm: number; heightCm: number };
  bottom: { widthCm: number; heightCm: number; thicknessCm: number };
} {
  const boxW_cm = sectionWidthCm - 0.5;
  const boxD_cm = frameDepthCm - 1.14;
  const boxH_cm = drawerHeightCm - 0.3;
  const innerW_cm = Math.max(boxW_cm - 2 * T, 2);
  return {
    side: { widthCm: round1(boxD_cm), heightCm: round1(boxH_cm) },
    back: { widthCm: round1(innerW_cm), heightCm: round1(boxH_cm) },
    bottom: {
      widthCm: round1(Math.max(innerW_cm - 0.2, 0.1)),
      heightCm: round1(Math.max(boxD_cm - 0.2, 0.1)),
      thicknessCm: 0.3,
    },
  };
}

const FRONT_TYPES = new Set(["drawer", "empty-section"]);

function doorReductionCm(section: WardrobeSection): number {
  let total = 0;
  for (const comp of section.components) {
    if (FRONT_TYPES.has(comp.type)) total += comp.height;
  }
  return total;
}

export function buildWardrobeLaminateChart(config: WardrobeConfig): LaminateRow[] {
  const rows: LaminateRow[] = [];
  const { frame, sections, doors } = config;
  const W = frame.width;
  const H = frame.height;
  const D = frame.depth;
  const backThickCm = 0.5;
  const base = config.base ?? {
    type: "floor" as const,
    legHeightCm: 10,
    plinthHeightCm: 10,
    plinthRecessCm: 8,
  };
  const topBottomW = W - 2 * T;
  const sidePanelHCm = base.type === "plinth" ? H + base.plinthHeightCm : H;

  rows.push({
    label: "Side panel (L)",
    widthCm: D,
    heightCm: sidePanelHCm,
    thicknessCm: T,
    qty: 1,
    category: "frame",
    note:
      base.type === "plinth"
        ? "Floor to top; includes plinth zone (matches 3D)"
        : "Face D×H, thickness T",
  });
  rows.push({
    label: "Side panel (R)",
    widthCm: D,
    heightCm: sidePanelHCm,
    thicknessCm: T,
    qty: 1,
    category: "frame",
  });
  rows.push({
    label: "Top panel",
    widthCm: topBottomW,
    heightCm: D,
    thicknessCm: T,
    qty: 1,
    category: "frame",
  });
  rows.push({
    label: "Bottom panel",
    widthCm: topBottomW,
    heightCm: D,
    thicknessCm: T,
    qty: 1,
    category: "frame",
  });

  rows.push({
    label: "Back panel",
    widthCm: W,
    heightCm: H,
    thicknessCm: backThickCm,
    qty: 1,
    // Back panels are HDF stock, not laminated — tracked separately from the
    // laminate cut-list in the admin orders view.
    category: "back",
    note: "HDF/back board (thin vs 1.8 cm carcass)",
  });

  const dividerH = H - 2 * T;
  const dividerD = D - 1;
  for (let i = 0; i < sections.length - 1; i++) {
    rows.push({
      label: `Vertical divider ${i + 1}`,
      widthCm: dividerD,
      heightCm: dividerH,
      thicknessCm: T,
      qty: 1,
      category: "frame",
    });
  }

  if (base.type === "plinth") {
    const betweenSidesW = Math.max(6, topBottomW);
    rows.push({
      label: "Plinth kick (front)",
      widthCm: round1(betweenSidesW),
      heightCm: round1(base.plinthHeightCm),
      thicknessCm: T,
      qty: 1,
      category: "frame",
      note: "Width W − 2×T between extended sides; aligns with door opening from front",
    });
    rows.push({
      label: "Plinth back",
      widthCm: round1(betweenSidesW),
      heightCm: round1(base.plinthHeightCm),
      thicknessCm: T,
      qty: 1,
      category: "frame",
    });
  }

  sections.forEach((section, sIdx) => {
    const sw = section.width;
    const shelfW = sw - 0.3;
    const shelfD = D - 0.4;

    section.components.forEach((comp, cIdx) => {
      if (comp.type === "shelf") {
        rows.push({
          label: `Shelf board — section ${sIdx + 1} #${cIdx + 1}`,
          widthCm: round1(shelfW),
          heightCm: round1(shelfD),
          thicknessCm: round1(comp.height),
          qty: 1,
          category: "interior",
          note: "Span × depth, shelf thickness = component height",
        });
      }
      if (comp.type === "shoe-rack") {
        const rackW = Math.max(0.1, sw - 0.6);
        const rackD = Math.max(0.1, (D - 2) * 0.6);
        rows.push({
          label: `Shoe-rack board — section ${sIdx + 1} #${cIdx + 1}`,
          widthCm: round1(rackW),
          heightCm: round1(rackD),
          thicknessCm: 1,
          qty: 1,
          category: "interior",
          note: "Angled shelf plank (matches 3D shoe-rack board)",
        });
      }
      if (comp.type === "drawer") {
        const drawerGapCm = 0.0002 / CM;
        const frontW = sw + T - 2 * drawerGapCm + doorFrontExtraWidthCm(sIdx, sections.length);
        const frontH = comp.height - 0.2;
        rows.push({
          label: `Drawer front — section ${sIdx + 1} #${cIdx + 1}`,
          widthCm: round1(frontW),
          heightCm: round1(frontH),
          thicknessCm: 0.8,
          qty: 1,
          category: "interior",
          note: "Front face (matches 3D)",
        });
        const box = wardrobeDrawerBoxCutsCm(sw, D, comp.height);
        if (box.side.widthCm > 0.05 && box.side.heightCm > 0.05) {
          rows.push({
            label: `Drawer side — section ${sIdx + 1} #${cIdx + 1}`,
            widthCm: box.side.widthCm,
            heightCm: box.side.heightCm,
            thicknessCm: T,
            qty: 2,
            category: "interior",
            note: "Laminated drawer box wing (matches 3D)",
          });
        }
        if (box.back.widthCm > 0.05 && box.back.heightCm > 0.05) {
          rows.push({
            label: `Drawer back — section ${sIdx + 1} #${cIdx + 1}`,
            widthCm: box.back.widthCm,
            heightCm: box.back.heightCm,
            thicknessCm: T,
            qty: 1,
            category: "interior",
          });
        }
        if (box.bottom.widthCm > 0.05 && box.bottom.heightCm > 0.05) {
          rows.push({
            label: `Drawer bottom — section ${sIdx + 1} #${cIdx + 1}`,
            widthCm: box.bottom.widthCm,
            heightCm: box.bottom.heightCm,
            thicknessCm: box.bottom.thicknessCm,
            qty: 1,
            category: "interior",
            note: "Thin bottom panel in 3D (≈3 mm)",
          });
        }
      }
    });
  });

  if (doors.type === "hinged") {
    sections.forEach((section, idx) => {
      const sw = section.width;
      const dw = sw + T - DOOR_GAP_CM * 2 + doorFrontExtraWidthCm(idx, sections.length);
      const reduction = doorReductionCm(section);
      const { dhExtraCm, centerYShiftCm } = doorFrontExtraHeightCm(reduction);
      let dh = H - T - DOOR_GAP_CM * 2 - reduction + dhExtraCm;
      const doorCenterYCm = T + reduction / 2 + H / 2 + centerYShiftCm;
      const maxTopCm = H - DOOR_GAP_CM;
      const topCm = doorCenterYCm + dh / 2;
      if (topCm > maxTopCm + 1e-6) dh -= topCm - maxTopCm;
      if (dh <= 0.01) return;
      rows.push({
        label: `Hinged door — section ${idx + 1}`,
        widthCm: round1(dw),
        heightCm: round1(dh),
        thicknessCm: DOOR_THICKNESS_CM,
        qty: 1,
        category: "door",
      });
    });
  } else if (doors.type === "sliding") {
    const doorCount = Math.max(2, doors.doorPanelMaterialIds.length);
    const { slidePanelW } = slidingDoorPanelWidthsCm(W, doorCount);
    const maxReduction = Math.max(...sections.map(doorReductionCm));
    const { dhExtraCm: slideDhExtraCm, centerYShiftCm } = doorFrontExtraHeightCm(maxReduction);
    let dh = H - T - DOOR_GAP_CM * 2 - maxReduction + slideDhExtraCm;
    const slideDoorYCm = maxReduction / 2 + H / 2 + centerYShiftCm;
    const maxTopCm = H - DOOR_GAP_CM;
    const topCm = slideDoorYCm + dh / 2;
    if (topCm > maxTopCm + 1e-6) dh -= topCm - maxTopCm;
    if (dh > 0.01) {
      for (let i = 0; i < doorCount; i++) {
        rows.push({
          label: `Sliding door panel ${i + 1}`,
          widthCm: round1(slidePanelW),
          heightCm: round1(dh),
          thicknessCm: DOOR_THICKNESS_CM,
          qty: 1,
          category: "door",
        });
      }
    }
  }

  return rows;
}
