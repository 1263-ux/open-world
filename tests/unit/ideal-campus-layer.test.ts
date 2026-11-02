import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';
import { createIdealCampusLayer, IDEAL_FACILITIES } from '../../src/scene/IdealCampusLayer';
import type { CampusId } from '../../src/shared/contracts';

function capsule(x: number, z: number) { return new Capsule(new THREE.Vector3(x, .47, z), new THREE.Vector3(x, 1.52, z), .35); }
for (const id of ['huyu', 'yingxi'] as CampusId[]) describe(`${id} original ground-only space`, () => {
  it('keeps every solid inside the approved envelope, with bounded rendering cost', () => {
    const layer = createIdealCampusLayer(id), bounds = IDEAL_FACILITIES[id].bounds;
    const box = new THREE.Box3().setFromObject(layer.colliders);
    expect(box.min.x).toBeGreaterThanOrEqual(bounds[0] - 1e-4); expect(box.max.x).toBeLessThanOrEqual(bounds[2] + 1e-4);
    expect(box.min.z).toBeGreaterThanOrEqual(bounds[1] - 1e-4); expect(box.max.z).toBeLessThanOrEqual(bounds[3] + 1e-4);
    expect(box.min.y).toBeCloseTo(.12); expect(box.max.y).toBeCloseTo(3.6);
    expect(layer.visual.children.length).toBeLessThanOrEqual(8);
    let triangles = 0; layer.visual.traverse(o => { if (o instanceof THREE.Mesh) triangles += o.geometry.getAttribute('position').count / 3; });
    expect(triangles).toBeLessThan(15000);
    expect(layer.colliders.children.length).toBeGreaterThan(1);
    expect(layer.colliders.children.length).toBeLessThan(150);
    layer.dispose();
  });
  it('leaves the complete ground circulation and shared switch zone clear', () => {
    const layer = createIdealCampusLayer(id), octree = new Octree().fromGraphNode(layer.colliders);
    const points: [number, number][] = [];
    if (id === 'huyu') {
      for (let x = -61; x <= -42; x += .25) points.push([x, -98]);
      for (let x = -61; x <= -45; x += .25) points.push([x, -90]);
      for (let z = -98; z <= -90; z += .25) points.push([-60, z]);
    } else for (let z = 173; z <= 185; z += .25) for (const x of [72.65, 73.5, 74.35]) points.push([x, z]);
    points.push(IDEAL_FACILITIES[id].sharedGroundZones[0]!.center);
    for (const [x, z] of points) expect(octree.capsuleIntersect(capsule(x, z)), `blocked ${x},${z}`).toBe(false);
    layer.dispose();
  });
  it('has closed roof and columns rather than phantom visual planes', () => {
    const layer = createIdealCampusLayer(id); layer.colliders.updateMatrixWorld(true);
    const [x, z] = id === 'huyu' ? [-65.25, -102.1] : [71.9, 174.65];
    const cast = (origin: THREE.Vector3, direction: THREE.Vector3) => new THREE.Raycaster(origin, direction).intersectObject(layer.colliders, true);
    expect(cast(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0))[0]!.point.y).toBeCloseTo(3.6);
    const underside = cast(new THREE.Vector3(x + .6, 2.8, z), new THREE.Vector3(0, 1, 0))[0]!.point.y;
    expect(underside).toBeGreaterThanOrEqual(3.2 - 1e-5); expect(underside).toBeLessThanOrEqual(3.22 + 1e-5);
    expect(cast(new THREE.Vector3(x + 1, 1, z), new THREE.Vector3(-1, 0, 0))[0]!.distance).toBeLessThan(1);
    layer.dispose();
  });
  it('uses identical triangle positions for every visible closed solid proxy', () => {
    const layer = createIdealCampusLayer(id), visible = new Set<string>();
    function triangles(mesh: THREE.Mesh) {
      const p = mesh.geometry.getAttribute('position');
      const result: string[] = [];
      for (let i = 0; i < p.count; i += 3) {
        const vertices = [i, i + 1, i + 2].map(j => `${p.getX(j)},${p.getY(j)},${p.getZ(j)}`);
        result.push(vertices.sort().join('|'));
      }
      return result;
    }
    layer.visual.traverse(o => { if (o instanceof THREE.Mesh) triangles(o).forEach(t => visible.add(t)); });
    layer.colliders.traverse(o => { if (o instanceof THREE.Mesh) for (const t of triangles(o)) expect(visible.has(t)).toBe(true); });
    layer.dispose();
  });
  it('owns independent resources and disposes each once across repeated calls', () => {
    const a = createIdealCampusLayer(id), b = createIdealCampusLayer(id);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    for (const root of [a.visual, a.colliders]) root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    let count = 0; for (const r of [...geometries, ...materials]) r.addEventListener('dispose', () => count++);
    b.visual.traverse(o => { if (o instanceof THREE.Mesh) { expect(geometries.has(o.geometry)).toBe(false); expect(materials.has(o.material as THREE.Material)).toBe(false); } });
    const host = new THREE.Group(); host.add(a.visual, a.colliders); a.dispose(); a.dispose();
    expect(host.children).toHaveLength(0); expect(count).toBe(geometries.size + materials.size); b.dispose();
  });
});
