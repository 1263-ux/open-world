import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CampusId } from '../shared/contracts';

/** Original speculative public spaces, NOT surveyed or existing campus buildings.
 * World-space geometry, ground-only circulation. No upstairs/roof access is designed.
 * Bounds exclude the explicitly approved flush, non-solid approach paving. */
export const IDEAL_FACILITIES: Record<CampusId, {
  id: string; label: string; bounds: [number, number, number, number];
  sharedGroundZones: { center: [number, number]; radius: number }[];
}> = {
  huyu: { id: 'ideal-meiying-court', label: '梅影书庭 · 原创理想空间', bounds: [-66, -103, -54, -87], sharedGroundZones: [{ center: [-49, -98], radius: 1.2 }] },
  yingxi: { id: 'ideal-qingze-colonnade', label: '清泽柱廊 · 原创理想空间', bounds: [71.5, 174, 75.5, 184], sharedGroundZones: [{ center: [69, 173], radius: 1.2 }] },
};

type Finish = 'stone' | 'wood' | 'bronze' | 'roof' | 'paving' | 'joint';
/** A closed, flat-shaded prism with clipped corners, not a transparent roof plane. */
function prism(x: number, z: number, width: number, depth: number, bottom: number, top: number, clip = 0) {
  const a = width / 2, b = depth / 2, c = Math.min(clip, a / 2, b / 2);
  const outline = new THREE.Shape();
  const points = [[-a + c, -b], [a - c, -b], [a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c]];
  outline.moveTo(points[0]![0]!, points[0]![1]!);
  for (const p of points.slice(1)) outline.lineTo(p[0]!, p[1]!);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(x, bottom, z);
  return geometry;
}

export function createIdealCampusLayer(campusId: CampusId): { visual: THREE.Group; colliders: THREE.Group; dispose(): void } {
  const visual = new THREE.Group(), colliders = new THREE.Group();
  visual.name = IDEAL_FACILITIES[campusId].id; colliders.name = `${visual.name}-solids`;
  const materials: Record<Finish, THREE.MeshStandardMaterial> = {
    stone: new THREE.MeshStandardMaterial({ color: '#ded8c6', roughness: .88 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8c5834', roughness: .76 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#494b43', roughness: .48, metalness: .35 }),
    roof: new THREE.MeshStandardMaterial({ color: '#b7bcad', roughness: .83 }),
    paving: new THREE.MeshStandardMaterial({ color: '#b8af99', roughness: .96 }),
    joint: new THREE.MeshStandardMaterial({ color: '#756c5c', roughness: 1 }),
  };
  const batches = new Map<Finish, THREE.BufferGeometry[]>(), solids: THREE.BufferGeometry[] = [];
  function add(finish: Finish, x: number, z: number, w: number, d: number, bottom: number, top: number, clip = 0, solid = true) {
    const g = prism(x, z, w, d, bottom, top, clip);
    const list = batches.get(finish) ?? []; list.push(g); batches.set(finish, list);
    if (solid) solids.push(g.clone());
  }
  // Paving lies below the existing .12m support plane: no new step/flight collider.
  function paving(x: number, z: number, w: number, d: number) {
    add('paving', x, z, w, d, .045, .055, .08, false);
    for (let zz = z - d / 2 + 1; zz < z + d / 2; zz += 1)
      add('joint', x, zz, w - .12, .018, .056, .058, 0, false);
  }
  function column(x: number, z: number) {
    add('stone', x, z, .46, .46, .12, .4, .065);
    add('bronze', x, z, .25, .25, .4, 3.2, .035);
    add('stone', x, z, .38, .38, 3.04, 3.2, .045);
    // Warm inward faces relieve the otherwise uniform dark structural rhythm.
    add('wood', x + .128, z, .022, .15, .48, 3.01, .005);
  }
  function canopy(x: number, z: number, w: number, d: number) {
    add('wood', x, z, w - .16, d - .16, 3.22, 3.3, .19);
    add('bronze', x, z, w, d, 3.3, 3.38, .24);
    add('stone', x, z, w - .08, d - .08, 3.38, 3.49, .23);
    add('roof', x, z, w - .28, d - .28, 3.49, 3.6, .22);
    // Recessed soffit joints contained inside the real roof thickness.
    for (let zz = z - d / 2 + .35; zz < z + d / 2 - .25; zz += .45)
      add('bronze', x, zz, w - .48, .026, 3.2, 3.22, 0);
  }
  function bench(x: number, z: number, w: number, d: number) {
    add('stone', x, z, w - .18, d - .12, .12, .43, .1);
    add('wood', x, z, w, d, .43, .56, .12);
    for (let xx = x - w / 2 + .2; xx < x + w / 2 - .1; xx += .18)
      add('bronze', xx, z, .012, d - .18, .56, .565, 0);
  }
  if (campusId === 'huyu') {
    paving(-60, -95, 12, 16);
    paving((-54 - 41.74) / 2, -98, 12.26, 2);
    paving((-54 - 44.77) / 2, -90, 9.23, 2);
    // Asymmetric U: an open sky court, framed views, two unobstructed east gates.
    canopy(-64.3, -95, 3.4, 16);
    canopy(-58.3, -101.5, 8.6, 3);
    canopy(-58.3, -88.5, 8.6, 3);
    for (const z of [-102.1, -98, -94, -90, -87.9]) column(-65.25, z);
    for (const z of [-102, -88]) for (const x of [-62.2, -58.6, -54.8]) column(x, z);
    bench(-64.25, -95.1, .85, 3.2);
    bench(-59.1, -101.9, 3.6, .72);
    bench(-58.4, -88.1, 2.5, .72);
    // Courtyard inset border, flush and walkable; no raised planter splitting gates.
    add('stone', -59.5, -99.55, 5.7, .12, .056, .06, 0, false);
    add('stone', -59.5, -90.45, 5.7, .12, .056, .06, 0, false);
    add('stone', -62.29, -95, .12, 9.1, .056, .06, 0, false);
  } else {
    paving(73.5, 179, 4, 10);
    paving(70.75, 173, 5.5, 2);
    // Split the north link at the hall edge; coplanar overlapping slabs flicker.
    paving(68.25, 184, 6.5, 2);
    paving(72.5, 184.5, 2, 1);
    canopy(73.5, 179, 4, 10);
    for (const z of [174.65, 177.55, 180.45, 183.35]) {
      column(71.9, z); column(75.1, z);
    }
    // Seats stay outside the entire 2.4m central walking corridor.
    bench(75.13, 179, .62, 1.65);
    bench(71.87, 179, .62, 1.65);
    add('stone', 72.4, 179, .08, 9.6, .056, .06, 0, false);
    add('stone', 74.6, 179, .08, 9.6, .056, .06, 0, false);
  }
  for (const [finish, pieces] of batches) {
    const geometry = mergeGeometries(pieces)!;
    pieces.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geometry, materials[finish]); mesh.name = finish;
    mesh.castShadow = finish !== 'paving' && finish !== 'joint'; mesh.receiveShadow = true; visual.add(mesh);
  }
  const colliderMaterial = new THREE.MeshBasicMaterial();
  // Keep each closed prism independent: the controller unions per-mesh inside
  // tests. Merging overlapping solids here would incorrectly produce XOR parity.
  for (const [i, geometry] of solids.entries()) {
    const collider = new THREE.Mesh(geometry, colliderMaterial);
    collider.name = `closed-solid-${i}`; colliders.add(collider);
  }
  let disposed = false;
  return { visual, colliders, dispose() {
    if (disposed) return; disposed = true;
    visual.removeFromParent(); colliders.removeFromParent();
    visual.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    solids.forEach(g => g.dispose()); colliderMaterial.dispose(); Object.values(materials).forEach(m => m.dispose());
    visual.clear(); colliders.clear();
  } };
}
