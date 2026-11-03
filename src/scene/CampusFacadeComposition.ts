/**
 * Original facade studies, not claims about a building's surveyed appearance.
 * This module only composes one wall in local metres. Callers explicitly select
 * source IDs, exclude replacement-model footprints, and replace their windows.
 * It does not change the source footprint, height, collision or photo rules.
 */
export type CampusFacadeFamily = 'paired-vertical' | 'horizontal-ribbon' | 'plinth-top';

export const CAMPUS_FACADE_PALETTE = Object.freeze({
  stone: Object.freeze({ color: 0x777a70, roughness: .95 }),
  trim: Object.freeze({ color: 0xd8d0bf, roughness: .91 }),
});

export const CAMPUS_FACADE_LIMITS = Object.freeze({
  minLength: 6,
  maxLength: 200,
  minHeight: 3.3,
  maxHeight: 200,
  maxFloors: 30,
  maxGroups: 20,
  maxWindows: 1200,
  maxStrips: 32,
});

export interface CampusFacadeEdgeInput {
  family: CampusFacadeFamily;
  length: number;
  height: number;
  /** The existing source-derived floor count. Unsupported counts are not changed. */
  floors: number;
}

export interface CampusFacadeCell {
  /** Distance from the edge's first point, not from its midpoint. */
  centerAlong: number;
  centerY: number;
  width: number;
  height: number;
  /** Outward distance from the original wall plane. */
  centerOut: number;
  depth: number;
  floor: number;
  group: number;
}

export interface CampusFacadeStrip {
  kind: 'base' | 'floor' | 'top' | 'pier';
  tone: keyof typeof CAMPUS_FACADE_PALETTE;
  centerAlong: number;
  centerY: number;
  width: number;
  height: number;
  centerOut: number;
  depth: number;
}

export interface CampusFacadeLayout {
  family: CampusFacadeFamily;
  palette: typeof CAMPUS_FACADE_PALETTE;
  groupCount: number;
  groupPitch: number;
  windows: CampusFacadeCell[];
  strips: CampusFacadeStrip[];
}

const PROFILES = {
  'paired-vertical': { pitch: 6.8, plinth: 1.15, coping: .34, windowHeight: 2.15 },
  'horizontal-ribbon': { pitch: 8.6, plinth: 1.2, coping: .38, windowHeight: 1.65 },
  'plinth-top': { pitch: 7.6, plinth: 1.3, coping: .56, windowHeight: 1.85 },
} as const;

// Match the existing instanced frame geometry; keep its outer rectangle clear
// of wall bands too. The pane front is .09m and the band front is .10m.
const FRAME_WIDTH = 1.15;
const FRAME_HEIGHT = 1.12;
const EDGE_MARGIN = .9;
const WALL_GAP = 1.6;
const BAND_GAP = .24;

/**
 * Build once per selected edge. Null requests the unchanged original treatment
 * for a narrow, low, invalid or out-of-budget edge, never a partial composition.
 * There are no THREE dependencies, randomness, cache, textures or frame work.
 */
export function composeCampusFacadeEdge(input: CampusFacadeEdgeInput): CampusFacadeLayout | null {
  const { family, length, height, floors } = input;
  const limits = CAMPUS_FACADE_LIMITS;
  if (!Object.hasOwn(PROFILES, family)
    || !Number.isFinite(length) || length < limits.minLength || length > limits.maxLength
    || !Number.isFinite(height) || height < limits.minHeight || height > limits.maxHeight
    || !Number.isInteger(floors) || floors < 1 || floors > limits.maxFloors) return null;

  const profile = PROFILES[family];
  const floorHeight = height / floors;
  if (floorHeight < 2.4) return null;
  const usableLength = length - EDGE_MARGIN * 2;
  // Large wall groups stay in the 3–10m range, including at both budget limits.
  const groupCount = Math.min(limits.maxGroups, Math.max(1,
    Math.ceil(usableLength / 10), Math.round(usableLength / profile.pitch)));
  const groupPitch = usableLength / groupCount;
  const windows: CampusFacadeCell[] = [];
  const strips: CampusFacadeStrip[] = [];
  const strip = (kind: CampusFacadeStrip['kind'], tone: CampusFacadeStrip['tone'],
    centerAlong: number, centerY: number, width: number, stripHeight: number) => {
    strips.push({ kind, tone, centerAlong, centerY, width, height: stripHeight, centerOut: .05, depth: .10 });
  };

  strip('base', 'stone', length / 2, profile.plinth / 2, length, profile.plinth);
  strip('top', 'trim', length / 2, height - profile.coping / 2, length, profile.coping);
  for (let floor = 1; floor < floors; floor++) {
    const topBoundary = floor === floors - 1;
    if (family === 'horizontal-ribbon') {
      strip('floor', 'trim', length / 2, floor * floorHeight, length, topBoundary ? .42 : .28);
    } else if (topBoundary) {
      strip('floor', 'trim', length / 2, floor * floorHeight, length, family === 'plinth-top' ? .5 : .34);
    } else if (family === 'plinth-top' && floor === 1) {
      strip('floor', 'trim', length / 2, floorHeight, length, .36);
    }
  }

  // Broad piers organize the paired family vertically; they occupy the solid
  // wall between pairs, not a thin mullion laid over glazing.
  if (family === 'paired-vertical' && floors >= 3) {
    const bottom = profile.plinth + .28;
    const top = (floors - 1) * floorHeight - .17 - BAND_GAP;
    for (let group = 1; group < groupCount; group++) {
      strip('pier', 'trim', EDGE_MARGIN + group * groupPitch, (bottom + top) / 2, .72, top - bottom);
    }
  }

  for (let floor = 0; floor < floors; floor++) {
    const topFloor = floors > 1 && floor === floors - 1;
    let bottom = floor === 0 ? profile.plinth + .28 : floor * floorHeight + .34;
    let top = floor === floors - 1 ? height - profile.coping - .28 : (floor + 1) * floorHeight - .34;
    for (const band of strips) {
      if (band.kind !== 'floor') continue;
      if (Math.abs(band.centerY - floor * floorHeight) < 1e-8) bottom = Math.max(bottom, band.centerY + band.height / 2 + BAND_GAP);
      if (Math.abs(band.centerY - (floor + 1) * floorHeight) < 1e-8) top = Math.min(top, band.centerY - band.height / 2 - BAND_GAP);
    }
    const desiredHeight = Math.min(profile.windowHeight, floorHeight * .62) * (topFloor ? .78 : 1);
    const windowHeight = Math.min(desiredHeight, (top - bottom) / FRAME_HEIGHT);
    if (windowHeight < .9) return null;
    const centerY = (bottom + top) / 2;
    const addWindow = (group: number, centerAlong: number, outerWidth: number) => {
      windows.push({ centerAlong, centerY, width: outerWidth / FRAME_WIDTH, height: windowHeight,
        centerOut: .04, depth: .10, floor, group });
    };
    for (let group = 0; group < groupCount; group++) {
      const centerAlong = EDGE_MARGIN + (group + .5) * groupPitch;
      if (family === 'paired-vertical') {
        const pairGap = .56;
        const outerWidth = (Math.min(4.6, groupPitch - WALL_GAP) - pairGap) / 2;
        const offset = (outerWidth + pairGap) / 2;
        addWindow(group, centerAlong - offset, outerWidth * (topFloor ? .8 : 1));
        addWindow(group, centerAlong + offset, outerWidth * (topFloor ? .8 : 1));
      } else if (family === 'horizontal-ribbon') {
        addWindow(group, centerAlong, Math.min(6.1, groupPitch - WALL_GAP) * (topFloor ? .72 : 1));
      } else {
        // A substantial base, quieter middle storeys and a wider, lower attic
        // row create a third silhouette without adding small ornamental parts.
        const outerWidth = Math.min(topFloor ? 5.4 : 3.2, groupPitch - WALL_GAP);
        addWindow(group, centerAlong, outerWidth);
      }
    }
  }
  return { family, palette: CAMPUS_FACADE_PALETTE, groupCount, groupPitch, windows, strips };
}
