import * as THREE from 'three';

/** Authored GAME GRAYBOX, not a real campus structure or final Astra artwork.
 * All coordinates are metres in the existing Yingxi world. No spatial data edits.
 * Final art must preserve these walking solids after actual traversal acceptance. */
export const VIEWING_PLATFORM = {
  id: 'original-viewing-platform', campusId: 'yingxi',
  center: [60, 179] as [number, number], groundFoot: .12, deckTop: 1.2,
  footprint: [[57.5, 173.8], [62.5, 173.8], [62.5, 181.5], [57.5, 181.5]],
  deck: { minX: 57.5, maxX: 62.5, minZ: 176.5, maxZ: 181.5 },
  stairs: { minX: 58.8, maxX: 61.2, minZ: 173.8, maxZ: 176.5, rises: 6, rise: .18, tread: .45 },
  approach: [60, .12, 172.8] as [number, number, number],
  bypass: [[55.8, 172.8], [55.8, 184], [65, 184]],
  clearReserve: { minX: 55, maxX: 68, minZ: 171.8, maxZ: 185.5 },
  photo: {
    position: [60, 178] as [number, number], radius: 1.1,
    heightRange: [1.1, 1.35] as [number, number],
    target: [35.85, .4, 205.4] as [number, number, number],
    // The garden's flower island and front curved seats, not the distant clock.
    frameExtent: [[33.2, .4, 205.4], [38.5, .4, 205.4], [35.85, .4, 204.08], [35.85, .4, 206.72]] as [number, number, number][],
    focusExtent: [[34.525, .4, 204.25685], [37.175, .4, 204.25685], [37.175, .4, 206.54315], [34.525, .4, 206.54315]] as [number, number, number][],
    landmarkId: 'yx-garden-setting',
  },
} as const;

/** Ground-only designed connection; not a mapped/surveyed campus road. */
export const PLATFORM_GROUND_LINKS: [number, number][][] = [
  [[35, 180], [60, 172.8]],
  [[60, 172.8], [60, 173.8]],
  // Approach the table from its open +Z front, not through its rear/worktop.
  // Extra east clearance also leaves room for a capsule at each path corner.
  [[60, 172.8], [60, 172], [68, 172], [68, 182], [65, 182], [65, 180.4]],
];

export const VIEWING_PLATFORM_PHOTO = VIEWING_PLATFORM.photo;

/** These are explicitly transformed METADATA anchors, not named GLB nodes.
 * Folding faces -Z; launch faces +Z. Station is on adjacent ground, NOT deck. */
export const PAPERPLANE_STATION = {
  position: [65, .12, 179] as [number, number, number], rotationY: 0,
  standing: [65, .12, 179.98] as [number, number, number],
  foldingDirection: [0, 0, -1] as [number, number, number],
  release: [65, 1.42, 179.85] as [number, number, number],
  launchDirection: [0, 0, 1] as [number, number, number], heading: Math.PI,
  interactionRadius: 1.8, heightRange: [.1, .35] as [number, number],
  assetUrl: '/assets/exhibits/paperplane-station.glb',
  metadataUrl: '/assets/exhibits/paperplane-station.metadata.json',
} as const;

/** Short authored flight lane: geometry clearance is not runtime playability. */
export const PAPERPLANE_COURSE = {
  id: 'qingze-paperplane',
  gates: [
    { center: [65, 1.5, 190], normal: [0, 0, 1], radius: 2 },
    { center: [65, 1.3, 207], normal: [0, 0, 1], radius: 2 },
    { center: [65, 1, 222], normal: [0, 0, 1], radius: 2 },
  ],
  landing: { center: [65, .12, 232], radius: 4 },
  bounds: { min: [60, -.5, 178], max: [70, 10, 239] },
  groundY: .12,
} as const;

export interface PlatformBox {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  kind: 'deck' | 'step' | 'guard' | 'station';
}
/** Closed BoxGeometry proxies: six faces, outward winding (Octree backface culls).
 * The visible graybox uses the identical boxes; there are no invisible fences. */
export const PLATFORM_BOXES: PlatformBox[] = [
  { name: 'deck', min: [57.5, .12, 176.5], max: [62.5, 1.2, 181.5], kind: 'deck' },
  { name: 'west-guard', min: [57.5, 1.2, 176.5], max: [57.68, 2.3, 181.5], kind: 'guard' },
  { name: 'east-guard', min: [62.32, 1.2, 176.5], max: [62.5, 2.3, 181.5], kind: 'guard' },
  { name: 'back-guard', min: [57.68, 1.2, 181.32], max: [62.32, 2.3, 181.5], kind: 'guard' },
  { name: 'entry-west-guard', min: [57.68, 1.2, 176.5], max: [58.8, 2.3, 176.68], kind: 'guard' },
  { name: 'entry-east-guard', min: [61.2, 1.2, 176.5], max: [62.32, 2.3, 176.68], kind: 'guard' },
];
for (let i = 0; i < 6; i++) {
  const z = 173.8 + i * .45, top = .12 + (i + 1) * .18;
  PLATFORM_BOXES.push({ name: `step-${i + 1}`, min: [58.8, .12, z], max: [61.2, top, z + .45], kind: 'step' });
  for (const [side, x0, x1] of [['west', 58.62, 58.8], ['east', 61.2, 61.38]] as const) {
    PLATFORM_BOXES.push({ name: `stair-${side}-guard-${i + 1}`, min: [x0, .12, z], max: [x1, top + 1.1, z + .45], kind: 'guard' });
  }
}
// Accepted Astra station component AABBs, transformed by (65,.12,179).
const stationBoxes: [string, number[], number[]][] = [
  ['worktop', [-1.12, .905, -.54], [1.12, .95, .42]],
  ['left-shoe', [-.945, 0, -.355], [-.73, .028, .27]],
  ['left-pier', [-.945, .022, -.355], [-.73, .913, .27]],
  ['right-shoe', [.73, 0, -.355], [.945, .028, .27]],
  ['right-pier', [.73, .022, -.355], [.945, .913, .27]],
  ['rear-stretcher', [-.915, .705, -.31], [.915, .765, -.245]],
  ['backfold-1', [-1.04, .935, -.499], [-.24, 1.42, -.346]],
  ['backfold-2', [-.24, .935, -.499], [1.04, 1.42, -.351]],
];
for (const [name, min, max] of stationBoxes) PLATFORM_BOXES.push({
  name: `station-${name}`, kind: 'station',
  min: [min[0] + 65, min[1] + .12, min[2] + 179],
  max: [max[0] + 65, max[1] + .12, max[2] + 179],
});

export function createOriginalViewingPlatform(): {
  visual: THREE.Group; colliders: THREE.Group; stationVisual: THREE.Group; dispose: () => void;
} {
  const visual = new THREE.Group(), colliders = new THREE.Group(), stationVisual = new THREE.Group();
  visual.name = 'original-viewing-platform-GRAYBOX';
  visual.userData.designStatus = 'Temporary original graybox; not a surveyed campus facility';
  colliders.name = 'original-viewing-platform-solids';
  stationVisual.name = 'paperplane-station-fallback';
  visual.add(stationVisual);
  const stone = new THREE.MeshStandardMaterial({ color: 0xcdcbc0, roughness: 1 });
  const guard = new THREE.MeshStandardMaterial({ color: 0x71857a, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x95704d, roughness: 1 });
  const proxyMaterial = new THREE.MeshBasicMaterial();
  const geometries: THREE.BufferGeometry[] = [];
  for (const box of PLATFORM_BOXES) {
    const [x, y, z] = box.min, [X, Y, Z] = box.max;
    const geometry = new THREE.BoxGeometry(X - x, Y - y, Z - z);
    const proxyGeometry = geometry.clone(); geometries.push(geometry, proxyGeometry);
    const mesh = new THREE.Mesh(geometry, box.kind === 'guard' ? guard : box.kind === 'station' ? wood : stone);
    mesh.name = box.name; mesh.position.set((x + X) / 2, (y + Y) / 2, (z + Z) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    (box.kind === 'station' ? stationVisual : visual).add(mesh);
    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = box.name; proxy.position.copy(mesh.position); colliders.add(proxy);
  }
  // Below the walking floor and intentionally non-colliding: readable access,
  // not another step/obstacle. No road/building data is changed.
  for (const points of PLATFORM_GROUND_LINKS) for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const geometry = new THREE.BoxGeometry(2.2, .025, Math.hypot(bx - ax, bz - az));
    geometries.push(geometry);
    const path = new THREE.Mesh(geometry, stone);
    path.name = 'original-platform-designed-ground-link';
    path.position.set((ax + bx) / 2, .065, (az + bz) / 2);
    path.rotation.y = Math.atan2(bx - ax, bz - az);
    path.receiveShadow = true; path.userData.photoIgnore = true; visual.add(path);
  }
  visual.updateMatrixWorld(true); colliders.updateMatrixWorld(true);
  // This handle owns ALL its resources, even detached fallback meshes. Caller
  // must either call this once OR its normal recursive disposer, never both.
  // Replacement GLB resources are owned by the scene, not by this handle.
  let disposed = false;
  return { visual, colliders, stationVisual, dispose: () => {
    if (disposed) return; disposed = true;
    visual.removeFromParent(); colliders.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const material of [stone, guard, wood, proxyMaterial]) material.dispose();
    stationVisual.clear(); visual.clear(); colliders.clear();
  } };
}
