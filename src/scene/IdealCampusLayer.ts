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

/** Read-only physical desk targets; the scene owns activity state and input. */
export const IDEAL_ACTIVITY_POINTS: Readonly<Record<CampusId, {
  readonly id: string; readonly kind: 'reading' | 'photos'; readonly label: string;
  readonly target: readonly [number, number, number]; readonly approach: readonly [number, number];
}>> = {
  huyu: { id: 'ideal-huyu-reading', kind: 'reading', label: '阅读校园介绍', target: [-64, 1.3, -95], approach: [-62.9, -95] },
  yingxi: { id: 'ideal-yingxi-photos', kind: 'photos', label: '翻阅照片手记', target: [75.12, 1.3, 179], approach: [74.25, 179] },
};

type Finish = 'stone' | 'wood' | 'bronze' | 'roof' | 'paving' | 'joint' | 'plant' | 'paper';
/** Original procedural surfaces. No network, canvas, random state or shared GPU owner.
 * Each tile represents 1m. Colour is sRGB; height is a separate linear map. */
function surface(kind: 'wood' | 'stone') {
  const size = 256, colour = new Uint8Array(size * size * 4), height = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const hash = (((x * 73856093) ^ (y * 19349663) ^ 4973) >>> 0) % 101 / 100;
    const grain = Math.sin(2 * Math.PI * (u * 39 + .38 * Math.sin(v * Math.PI * 4))) * .5
      + Math.sin(2 * Math.PI * (u * 83 + .21 * Math.sin(v * Math.PI * 6))) * .22;
    const vein = Math.sin(2 * Math.PI * (u * 3 + v * 2 + .15 * Math.sin(v * Math.PI * 4)));
    const value = kind === 'wood' ? grain * 15 + (hash - .5) * 8 : vein * 4 + (hash - .5) * 16;
    const base = kind === 'wood' ? [167, 116, 72] : [219, 212, 193];
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) { colour[i + k] = base[k]! + value; height[i + k] = 128 + value * 2; }
    colour[i + 3] = height[i + 3] = 255;
  }
  const make = (data: Uint8Array, srgb: boolean) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = `ideal-original-${kind}-${srgb ? 'colour' : 'height'}`;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
  };
  return { map: make(colour, true), bumpMap: make(height, false) };
}

function surfaceUv(geometry: THREE.BufferGeometry, originX: number, originZ: number) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    // Keep 1m texture scale across unlike roof, furniture and paving sizes.
    const x = p.getX(i) - originX, z = p.getZ(i) - originZ;
    if (Math.abs(n.getY(i)) > .5) uv.setXY(i, x, z);
    else if (Math.abs(n.getX(i)) > .5) uv.setXY(i, z, p.getY(i));
    else uv.setXY(i, x, p.getY(i));
  }
}
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
  const woodSurface = surface('wood'), stoneSurface = surface('stone');
  const textures = [...Object.values(woodSurface), ...Object.values(stoneSurface)];
  const materials: Record<Finish, THREE.MeshStandardMaterial> = {
    stone: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .84, ...stoneSurface, bumpScale: .009 }),
    wood: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .68, ...woodSurface, bumpScale: .006 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#494b43', roughness: .48, metalness: .35 }),
    roof: new THREE.MeshStandardMaterial({ color: '#b7bcad', roughness: .83 }),
    paving: new THREE.MeshStandardMaterial({ color: '#d4cab5', roughness: .94, ...stoneSurface, bumpScale: .004 }),
    joint: new THREE.MeshStandardMaterial({ color: '#665b49', roughness: 1 }),
    plant: new THREE.MeshStandardMaterial({ color: '#526844', roughness: .9, flatShading: true, vertexColors: true }),
    paper: new THREE.MeshStandardMaterial({ color: '#f0e5ca', roughness: .95 }),
  };
  const batches = new Map<Finish, THREE.BufferGeometry[]>(), solids: THREE.BufferGeometry[] = [];
  function add(finish: Finish, x: number, z: number, w: number, d: number, bottom: number, top: number, clip = 0, solid = true) {
    const g = prism(x, z, w, d, bottom, top, clip);
    surfaceUv(g, -60, -95);
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
    for (let zz = z - d / 2 + .35; zz < z + d / 2 - .25; zz += 1.35)
      add('bronze', x, zz, w - .48, .026, 3.2, 3.22, 0);
  }
  function bench(x: number, z: number, w: number, d: number) {
    add('stone', x, z, w - .18, d - .12, .12, .43, .1);
    add('wood', x, z, w, d, .43, .56, .12);
    // Slat seams are tonal texture, not dozens of microscopic collision meshes.
  }
  function screen(x: number, z: number, length: number) {
    for (const zz of [z - length / 2 + .08, z + length / 2 - .08])
      add('bronze', x, zz, .16, .16, .12, 2.06, .02);
    add('bronze', x, z, .16, length, .65, .73, .02);
    add('bronze', x, z, .16, length, 1.98, 2.06, .02);
    for (let zz = z - length / 2 + .1; zz < z + length / 2; zz += .36)
      add('wood', x, zz, .12, .1, .73, 1.98, .02);
  }
  function readingDesk(x: number, z: number, width: number, length: number) {
    add('stone', x, z, width - .18, length - .25, .12, .32, .08);
    for (const zz of [z - length / 2 + .22, z + length / 2 - .22])
      add('bronze', x, zz, width - .3, .14, .32, .92, .025);
    add('wood', x, z, width, length, .92, 1.02, .06);
    // A restrained pair of open books makes the intended use legible without text textures.
    for (const zz of [z - length * .22, z + length * .22]) {
      add('bronze', x, zz, width * .68, .45, 1.02, 1.045, .02);
      add('paper', x, zz, width * .6, .39, 1.045, 1.075, .015);
      add('wood', x, zz, .018, .39, 1.075, 1.078);
    }
  }
  function planter(x: number, z: number, width: number, length: number) {
    add('stone', x, z, width, length, .12, .55, .18);
    add('joint', x, z, width - .16, length - .16, .55, .58, .14);
    // Closed, low irregular planting masses, always within the planter footprint.
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale((width - .22) / 2, .3 + i * .025, (length - .2) / 4);
      g.translate(x, .69, z + (i - 1) * (length - .2) / 4);
      const position = g.getAttribute('position'), colours = new Float32Array(position.count * 3);
      for (let j = 0; j < position.count; j++) {
        const light = .86 + i * .055 + Math.max(0, g.getAttribute('normal').getY(j)) * .18;
        colours.set([light, light, light * .94], j * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      const list = batches.get('plant') ?? []; list.push(g); batches.set('plant', list); solids.push(g.clone());
    }
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
    // West-side reading focus faces the two east entries. The cross-court loop stays open.
    screen(-65.5, -95, 4.4);
    readingDesk(-64, -95, .85, 3.2);
    planter(-56.7, -94.7, 1.8, 2.9);
    bench(-64.25, -99.6, .85, 1.6);
    add('wood', -64.68, -99.6, .12, 1.6, .56, 1.15, .03);
    // Seats fit between structural columns rather than intersecting a column shaft.
    bench(-60.3, -101.9, 2.8, .72);
    bench(-56.7, -88.1, 2.8, .72);
    add('wood', -60.3, -102.23, 2.8, .12, .56, 1.15, .03);
    add('wood', -56.7, -87.77, 2.8, .12, .56, 1.15, .03);
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
    readingDesk(75.12, 179, .6, 1.65);
    screen(75.36, 179, 2.3);
    // Display case uses existing opaque finishes, not transparent/extra draw passes.
    add('stone', 75.3, 179, .12, 1.35, 1.17, 1.82, .03);
    add('bronze', 75.22, 179, .025, 1.16, 1.27, 1.72, .01);
    for (const zz of [178.65, 179, 179.35]) add('paper', 75.201, zz, .012, .27, 1.32, 1.67);
    planter(75.13, 175.9, .62, 1.05);
    planter(71.87, 182.1, .62, 1.05);
    bench(71.87, 179, .62, 1.65);
    add('wood', 71.59, 179, .12, 1.65, .56, 1.16, .025);
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
    solids.forEach(g => g.dispose()); colliderMaterial.dispose(); Object.values(materials).forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    visual.clear(); colliders.clear();
  } };
}
