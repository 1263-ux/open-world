import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createFoliageGeometry } from '../../src/scene/SurfaceStyle';

describe('instanced campus crown geometry', () => {
  it('is deterministic, single-draw, and below the original 800-triangle budget', () => {
    const a = createFoliageGeometry(), b = createFoliageGeometry();
    expect((a.index?.count ?? a.getAttribute('position').count) / 3).toBe(752);
    expect(a.groups).toEqual([]);
    for (const key of ['position', 'normal', 'color', 'uv']) {
      expect(Array.from(a.getAttribute(key).array)).toEqual(Array.from(b.getAttribute(key).array));
    }
    a.dispose(); b.dispose();
  });

  it('retains the origin and fits the old local envelope without growing tree reach', () => {
    const g = createFoliageGeometry();
    const bounds = g.boundingBox!;
    const oldMin = [-.923390, -.749866, -1.035133];
    const oldMax = [1.027061, .747240, .983565];
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

  it('has four closed crown volumes, not hundreds of disconnected leaf cards', () => {
    const g = createFoliageGeometry(), p = g.getAttribute('position');
    // Each crown's 180 triangles precede the eight four-triangle edge leaves.
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

  it('contains finite nondegenerate triangles, unit normals and quiet opaque vertex tones', () => {
    const g = createFoliageGeometry(), p = g.getAttribute('position');
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
