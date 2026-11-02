import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createFoliageGeometry, getFoliageVariation } from '../../src/scene/SurfaceStyle';

describe.each([0, 1] as const)('instanced campus crown geometry variant %i', (variant) => {
  it('is deterministic, single-draw, and below the original 800-triangle budget', () => {
    const a = createFoliageGeometry(variant), b = createFoliageGeometry(variant);
    expect((a.index?.count ?? a.getAttribute('position').count) / 3).toBe(720);
    expect(a.groups).toEqual([]);
    for (const key of ['position', 'normal', 'color', 'uv']) {
      expect(Array.from(a.getAttribute(key).array)).toEqual(Array.from(b.getAttribute(key).array));
    }
    a.dispose(); b.dispose();
  });

  it('retains the origin and fits the old local envelope without growing tree reach', () => {
    const g = createFoliageGeometry(variant);
    const bounds = g.boundingBox!;
    const oldMin = [-.9156770111, -.7057256103, -.9566492439];
    const oldMax = [.9453455806, .7185544968, .8530370594];
    const min = bounds.min.toArray(), max = bounds.max.toArray();
    for (let axis = 0; axis < 3; axis++) {
      expect(min[axis]).toBeGreaterThanOrEqual(oldMin[axis]);
      expect(max[axis]).toBeLessThanOrEqual(oldMax[axis]);
      expect(max[axis] - min[axis]).toBeGreaterThan((oldMax[axis] - oldMin[axis]) * .88);
    }
    expect(bounds.containsPoint(new Vector3())).toBe(true);
    expect(g.boundingSphere!.radius).toBeLessThanOrEqual(1.231);
    g.dispose();
  });

  it('has four closed crown volumes and no disconnected leaf cards', () => {
    const g = createFoliageGeometry(variant), p = g.getAttribute('position');
    // Each crown is 180 triangles; there are no disconnected leaf tips.
    for (let lobe = 0; lobe < 4; lobe++) {
      const edges = new Map<string, number>();
      const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(x => x.toFixed(6)).join(',');
      for (let i = lobe * 540; i < (lobe + 1) * 540; i += 3) {
        for (let e = 0; e < 3; e++) {
          const edge = [key(i + e), key(i + (e + 1) % 3)].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
    }
    g.dispose();
  });

  it('smooths coincident normals inside each lobe without welding separate crowns', () => {
    const g = createFoliageGeometry(variant), p = g.getAttribute('position'), normals = g.getAttribute('normal');
    for (let lobe = 0; lobe < 4; lobe++) {
      const seen = new Map<string, number[]>();
      for (let i = lobe * 540; i < (lobe + 1) * 540; i++) {
        const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(6)).join(',');
        const normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
        if (seen.has(key)) expect(normal).toEqual(seen.get(key));
        seen.set(key, normal);
      }
    }
    g.dispose();
  });

  it('contains finite nondegenerate triangles, unit normals and quiet opaque vertex tones', () => {
    const g = createFoliageGeometry(variant), p = g.getAttribute('position');
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-10);
    }
    const normal = g.getAttribute('normal'), color = g.getAttribute('color');
    expect(color.itemSize).toBe(3); // No alpha attribute or material groups.
    for (let i = 0; i < p.count; i++) {
      expect(a.fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
      for (const channel of [color.getX(i), color.getY(i), color.getZ(i)]) {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThan(.6); expect(channel).toBeLessThan(1);
      }
    }
    g.dispose();
  });
});


describe('position-stable crown variation', () => {
  it('keeps the no-argument API identical to variant zero', () => {
    const a = createFoliageGeometry(), b = createFoliageGeometry(0);
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    a.dispose(); b.dispose();
  });
  it('gives distinct silhouettes without adding triangles or material groups', () => {
    const a = createFoliageGeometry(0), b = createFoliageGeometry(1);
    expect(Array.from(a.getAttribute('position').array)).not.toEqual(Array.from(b.getAttribute('position').array));
    expect(Object.values(a.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0)).toBe(95040);
    expect(Object.values(b.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0)).toBe(95040);
    a.dispose(); b.dispose();
  });
  it('keeps the non-rotated variants within the current closed-crown envelope', () => {
    for (const variant of [0, 1] as const) for (const yaw of [0]) {
      const g = createFoliageGeometry(variant);
      g.rotateY(yaw); g.computeBoundingBox();
      const box = g.boundingBox!;
      expect(box.min.x).toBeGreaterThanOrEqual(-.9156770111);
      expect(box.min.y).toBeGreaterThanOrEqual(-.7057256103);
      expect(box.min.z).toBeGreaterThanOrEqual(-.9566492439);
      expect(box.max.x).toBeLessThanOrEqual(.9453455806);
      expect(box.max.y).toBeLessThanOrEqual(.7185544968);
      expect(box.max.z).toBeLessThanOrEqual(.8530370594);
      g.dispose();
    }
  });
  it('uses world positions, not list order, with bounded color and yaw', () => {
    const positions = Array.from({ length: 40 }, (_, i) => [i * 3.7 - 70, i * 5.3 - 60]);
    const original = positions.map(([x, z]) => getFoliageVariation(x, z));
    const reordered = [...positions].reverse().map(([x, z]) => getFoliageVariation(x, z)).reverse();
    expect(reordered).toEqual(original);
    expect(new Set(original.map(v => v.variant)).size).toBe(2);
    expect(new Set(original.map(v => v.yaw))).toEqual(new Set([0]));
    for (const v of original) {
      expect([0, 1]).toContain(v.variant); expect(v.yaw).toBe(0);
      expect(v.colorScale).toBeGreaterThanOrEqual(.97); expect(v.colorScale).toBeLessThanOrEqual(1.03);
    }
    expect(() => getFoliageVariation(NaN, 0)).toThrow('must be finite');
    expect(() => getFoliageVariation(0, Infinity)).toThrow('must be finite');
  });
});
