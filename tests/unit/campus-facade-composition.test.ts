import { describe, expect, it } from 'vitest';
import {
  CAMPUS_FACADE_LIMITS, CAMPUS_FACADE_PALETTE, composeCampusFacadeEdge,
  type CampusFacadeCell, type CampusFacadeFamily,
} from '../../src/scene/CampusFacadeComposition';

const families: CampusFacadeFamily[] = ['paired-vertical', 'horizontal-ribbon', 'plinth-top'];
const make = (family: CampusFacadeFamily, length = 48, height = 17, floors = 5) =>
  composeCampusFacadeEdge({ family, length, height, floors });
const outer = (cell: CampusFacadeCell) => ({
  left: cell.centerAlong - cell.width * 1.15 / 2,
  right: cell.centerAlong + cell.width * 1.15 / 2,
  bottom: cell.centerY - cell.height * 1.12 / 2,
  top: cell.centerY + cell.height * 1.12 / 2,
});

describe.each(families)('bounded original facade: %s', (family) => {
  it('returns deterministic replacement data without mutating the input', () => {
    const input = Object.freeze({ family, length: 48, height: 17, floors: 5 });
    const first = composeCampusFacadeEdge(input)!;
    expect(composeCampusFacadeEdge(input)).toEqual(first);
    expect(input).toEqual({ family, length: 48, height: 17, floors: 5 });
    expect(first.windows).not.toBe(composeCampusFacadeEdge(input)!.windows);
    expect(first.palette).toBe(CAMPUS_FACADE_PALETTE);
    expect(first.windows.length).toBeGreaterThan(0);
    expect(new Set(first.windows.map(cell => cell.floor))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(new Set(first.windows.map(cell => `${cell.centerAlong}:${cell.centerY}`)).size).toBe(first.windows.length);
  });

  it('uses metre-scale groups, exposed wall gaps and a 1–1.3m stone plinth', () => {
    const layout = make(family)!;
    expect(layout.groupPitch).toBeGreaterThanOrEqual(3);
    expect(layout.groupPitch).toBeLessThanOrEqual(10);
    const base = layout.strips.find(s => s.kind === 'base')!;
    expect(base.tone).toBe('stone');
    expect(base.height).toBeGreaterThanOrEqual(1);
    expect(base.height).toBeLessThanOrEqual(1.3);
    expect(base.width).toBe(48);
    for (let floor = 0; floor < 5; floor++) {
      const cells = layout.windows.filter(cell => cell.floor === floor);
      for (let group = 1; group < layout.groupCount; group++) {
        const before = cells.filter(cell => cell.group === group - 1).map(outer);
        const after = cells.filter(cell => cell.group === group).map(outer);
        expect(Math.min(...after.map(cell => cell.left)) - Math.max(...before.map(cell => cell.right))).toBeGreaterThanOrEqual(1.6 - 1e-10);
      }
    }
  });

  it('fits the source wall and legacy outer frames, without intersecting any strip', () => {
    const layout = make(family)!;
    for (const cell of layout.windows) {
      const bounds = outer(cell);
      expect(bounds.left).toBeGreaterThanOrEqual(.9);
      expect(bounds.right).toBeLessThanOrEqual(48 - .9);
      expect(bounds.bottom).toBeGreaterThan(0);
      expect(bounds.top).toBeLessThan(17);
      for (const strip of layout.strips) {
        const alongOverlap = Math.min(bounds.right, strip.centerAlong + strip.width / 2)
          - Math.max(bounds.left, strip.centerAlong - strip.width / 2);
        const heightOverlap = Math.min(bounds.top, strip.centerY + strip.height / 2)
          - Math.max(bounds.bottom, strip.centerY - strip.height / 2);
        expect(alongOverlap <= 1e-10 || heightOverlap <= 1e-10).toBe(true);
      }
    }
    for (const strip of layout.strips) {
      expect(strip.centerAlong - strip.width / 2).toBeGreaterThanOrEqual(0);
      expect(strip.centerAlong + strip.width / 2).toBeLessThanOrEqual(48);
      expect(strip.centerY - strip.height / 2).toBeGreaterThanOrEqual(-1e-10);
      expect(strip.centerY + strip.height / 2).toBeLessThanOrEqual(17 + 1e-10);
      expect(strip.width).toBeGreaterThanOrEqual(.72);
      expect(strip.height).toBeGreaterThanOrEqual(.28);
    }
  });

  it('retains the .1m outer envelope with a real noncoplanar front-plane gap', () => {
    const layout = make(family)!;
    const pane = layout.windows[0];
    const strip = layout.strips[0];
    expect(pane.centerOut + pane.depth / 2).toBeCloseTo(.09, 12);
    expect(strip.centerOut + strip.depth / 2).toBeCloseTo(.10, 12);
    expect(strip.centerOut + strip.depth / 2 - pane.centerOut - pane.depth / 2).toBeCloseTo(.01, 12);
    expect(pane.centerOut + pane.depth * .55 / 2).toBeLessThan(.09);
    for (const part of [...layout.windows, ...layout.strips]) {
      expect(part.centerOut + part.depth / 2).toBeLessThanOrEqual(.1);
    }
  });

  it('differentiates the top storey and separates it from coping and the base', () => {
    const layout = make(family)!;
    const top = layout.windows.filter(cell => cell.floor === 4);
    const middle = layout.windows.filter(cell => cell.floor === 2);
    expect(top[0].height).toBeLessThan(middle[0].height);
    expect(top[0].width).not.toBe(middle[0].width);
    const base = layout.strips.find(s => s.kind === 'base')!;
    const coping = layout.strips.find(s => s.kind === 'top')!;
    expect(Math.min(...layout.windows.filter(cell => cell.floor === 0).map(cell => outer(cell).bottom))
      - (base.centerY + base.height / 2)).toBeGreaterThanOrEqual(.28 - 1e-10);
    expect((coping.centerY - coping.height / 2) - Math.max(...top.map(cell => outer(cell).top)))
      .toBeGreaterThanOrEqual(.28 - 1e-10);
  });

  it('rejects invalid, too narrow, too low or over-budget input rather than changing it', () => {
    const input = { family, length: 48, height: 17, floors: 5 };
    for (const length of [NaN, Infinity, -Infinity, -1, 0, 5.99, 200.01, Number.MAX_VALUE]) {
      expect(composeCampusFacadeEdge({ ...input, length })).toBeNull();
    }
    for (const height of [NaN, Infinity, -1, 0, 3.29, 200.01, Number.MAX_VALUE]) {
      expect(composeCampusFacadeEdge({ ...input, height })).toBeNull();
    }
    for (const floors of [NaN, Infinity, -1, 0, 1.5, 31, Number.MAX_SAFE_INTEGER]) {
      expect(composeCampusFacadeEdge({ ...input, floors })).toBeNull();
    }
    expect(make(family, 48, 7, 5)).toBeNull();
    expect(make(family, 48, 12, 5)).toBeNull(); // First-floor frame cannot clear the plinth.
  });

  it('has finite bounded cost at the largest accepted dimensions', () => {
    const layout = make(family, 200, 200, 30)!;
    expect(layout.groupCount).toBeLessThanOrEqual(CAMPUS_FACADE_LIMITS.maxGroups);
    expect(layout.windows.length).toBeLessThanOrEqual(CAMPUS_FACADE_LIMITS.maxWindows);
    expect(layout.strips.length).toBeLessThanOrEqual(CAMPUS_FACADE_LIMITS.maxStrips);
    expect(layout.groupPitch).toBeLessThanOrEqual(10);
    for (const part of [...layout.windows, ...layout.strips]) {
      for (const field of ['centerAlong', 'centerY', 'width', 'height', 'centerOut', 'depth'] as const) {
        expect(Number.isFinite(part[field])).toBe(true);
      }
      expect(part.width).toBeGreaterThan(0);
      expect(part.height).toBeGreaterThan(0);
    }
  });
});

describe('family contrast and shared resources', () => {
  it('makes paired vertical cells, broad segmented ribbons, and a wider attic row distinct', () => {
    const vertical = make('paired-vertical')!;
    const ribbon = make('horizontal-ribbon')!;
    const plinth = make('plinth-top')!;
    expect(vertical.windows.filter(cell => cell.floor === 2 && cell.group === 0)).toHaveLength(2);
    expect(vertical.strips.some(strip => strip.kind === 'pier')).toBe(true);
    expect(ribbon.windows.filter(cell => cell.floor === 2 && cell.group === 0)).toHaveLength(1);
    expect(ribbon.windows.find(cell => cell.floor === 2)!.width).toBeGreaterThan(4);
    expect(ribbon.strips.filter(strip => strip.kind === 'floor')).toHaveLength(4);
    expect(plinth.windows.find(cell => cell.floor === 4)!.width).toBeGreaterThan(plinth.windows.find(cell => cell.floor === 2)!.width);
    expect(plinth.strips.filter(strip => strip.kind === 'floor')).toHaveLength(2);
    expect(new Set([vertical, ribbon, plinth].map(layout => JSON.stringify(layout.windows))).size).toBe(3);
  });

  it('shares exactly two immutable numeric material descriptions across families', () => {
    expect(Object.keys(CAMPUS_FACADE_PALETTE)).toEqual(['stone', 'trim']);
    expect(Object.isFrozen(CAMPUS_FACADE_PALETTE)).toBe(true);
    for (const entry of Object.values(CAMPUS_FACADE_PALETTE)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Number.isInteger(entry.color)).toBe(true);
      expect(entry.color).toBeGreaterThanOrEqual(0);
      expect(entry.color).toBeLessThanOrEqual(0xffffff);
      expect(entry.roughness).toBeGreaterThan(.8);
      expect(entry.roughness).toBeLessThanOrEqual(1);
    }
    for (const family of families) expect(make(family)!.palette).toBe(CAMPUS_FACADE_PALETTE);
    expect(composeCampusFacadeEdge({ family: 'toString' as CampusFacadeFamily, length: 48, height: 17, floors: 5 })).toBeNull();
  });

  it('checks varied dimensions including one-storey edges without tiny hanging strips', () => {
    for (const family of families) for (const length of [6, 7, 10, 11.9, 20, 49.7, 100, 200]) {
      for (const floors of [1, 2, 3, 7, 30]) {
        const height = floors * 3.8;
        const layout = make(family, length, height, floors)!;
        expect(layout).not.toBeNull();
        expect(layout.groupPitch).toBeGreaterThanOrEqual(3);
        expect(layout.groupPitch).toBeLessThanOrEqual(10);
        expect(layout.strips.length).toBeLessThanOrEqual(CAMPUS_FACADE_LIMITS.maxStrips);
        for (const cell of layout.windows) {
          const bounds = outer(cell);
          expect(bounds.left).toBeGreaterThanOrEqual(.9 - 1e-10);
          expect(bounds.right).toBeLessThanOrEqual(length - .9 + 1e-10);
          expect(bounds.top).toBeLessThan(height);
          expect(bounds.bottom).toBeGreaterThan(1);
          for (const strip of layout.strips) {
            const alongOverlap = Math.min(bounds.right, strip.centerAlong + strip.width / 2)
              - Math.max(bounds.left, strip.centerAlong - strip.width / 2);
            const heightOverlap = Math.min(bounds.top, strip.centerY + strip.height / 2)
              - Math.max(bounds.bottom, strip.centerY - strip.height / 2);
            expect(alongOverlap <= 1e-10 || heightOverlap <= 1e-10).toBe(true);
          }
        }
      }
    }
  });
});
