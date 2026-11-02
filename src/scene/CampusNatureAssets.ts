import * as THREE from 'three';

/** CC0 KayKit subset. Ground anchor is the author's y=0, NOT the lowest root vertex. */
export type NatureKind = 'tree-round' | 'tree-tall' | 'tree-spreading' | 'shrub' | 'grass';
export interface NaturePlacement {
  readonly kind: NatureKind;
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly rotationY?: number;
  readonly id?: string;
}
export const NATURE_MODEL_BOUNDS: Readonly<Record<NatureKind, {
  readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number]; readonly triangles: number;
}>> = {
  'tree-round': { min: [-1.789522, -.341037, -1.722744], max: [2.217305, 4.588587, 1.722745], triangles: 636 },
  'tree-tall': { min: [-2.745805, -.392320, -2.876676], max: [3.945491, 7.421931, 2.876678], triangles: 1364 },
  'tree-spreading': { min: [-2.091640, -.341037, -2.064709], max: [2.037777, 4.011838, 2.064708], triangles: 988 },
  shrub: { min: [-1.245024, -.026810, -1.245024], max: [1.245024, 1.123845, 1.245024], triangles: 272 },
  grass: { min: [-.266016, -.056290, -.336838], max: [.239060, .481206, .218885], triangles: 132 },
};
export const CAMPUS_NATURE_URL = `${import.meta.env.BASE_URL}models/nature/campus-nature.glb`;
export const NATURE_ATLAS_GPU_BYTES = 1024 * 1024 * 4 * 4 / 3;
const kinds = Object.keys(NATURE_MODEL_BOUNDS) as NatureKind[];

// Derived rendering only: original CC0 GLB/atlas bytes and authored contrast stay intact.
// r186 map_fragment produces linear diffuseColor; harmonize before lighting, not
// after tone mapping. Rec.709 desaturation preserves luma; tint is a subtle channel adjustment, not a global exposure cut.
export const NATURE_ALBEDO_TONE = Object.freeze({
  version: 1, desaturation: .32, tint: Object.freeze([.98, 1, .96] as const),
});
const natureToneCacheKey = `campus-nature-albedo-v${NATURE_ALBEDO_TONE.version}:${NATURE_ALBEDO_TONE.desaturation}:${NATURE_ALBEDO_TONE.tint.join(',')}`;
function harmonizeNatureAlbedo(material: THREE.MeshStandardMaterial): void {
  const tone = NATURE_ALBEDO_TONE;
  material.onBeforeCompile = shader => {
    const anchor = '#include <map_fragment>';
    if (!shader.fragmentShader.includes(anchor)) throw new Error('Campus nature albedo requires the r186 map_fragment chunk');
    shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}
#ifdef USE_MAP
  float campusNatureLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(campusNatureLuma), ${tone.desaturation.toFixed(6)});
  diffuseColor.rgb *= vec3(${tone.tint.map(n => n.toFixed(6)).join(', ')});
#endif`);
  };
  // Shader cache identity includes every fixed rendering parameter, not callback text.
  material.customProgramCacheKey = () => natureToneCacheKey;
  material.needsUpdate = true;
}


function placementMatrix(p: NaturePlacement) {
  if (!NATURE_MODEL_BOUNDS[p.kind] || !Number.isFinite(p.scale) || p.scale <= 0 || p.scale > 4
    || p.position.length !== 3 || !p.position.every(Number.isFinite) || !Number.isFinite(p.rotationY ?? 0))
    throw new Error('Invalid nature placement; finite position and scale in (0,4] required');
  return new THREE.Matrix4().compose(new THREE.Vector3(...p.position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY ?? 0), new THREE.Vector3().setScalar(p.scale));
}
export function getNaturePlacementBounds(p: NaturePlacement): THREE.Box3 {
  const matrix = placementMatrix(p), b = NATURE_MODEL_BOUNDS[p.kind];
  return new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(matrix);
}

/** Split actual connected solids, then close the author's open wood end rings.
 * Caps exist only in collision copies. We never fill the space BETWEEN branches,
 * join separate crowns, or apply whole-model parity to overlapping pieces. */
export function createNatureCollisionGeometries(geometry: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!position || (index?.count ?? position.count) % 3) throw new Error('Nature geometry has invalid triangles');
  const vertices: THREE.Vector3[] = [], welded: number[] = [], keys = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(position, i);
    const key = [v.x, v.y, v.z].map(n => Math.round(n * 1e5)).join(',');
    let id = keys.get(key);
    if (id === undefined) { id = vertices.length; vertices.push(v); keys.set(key, id); }
    welded.push(id);
  }
  const parent = vertices.map((_, i) => i);
  const root = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const triangles: [number, number, number][] = [];
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const t = [0, 1, 2].map(j => welded[index ? index.getX(i + j) : i + j]!) as [number, number, number];
    if (new Set(t).size < 3) continue;
    parent[root(t[1])] = root(t[0]); parent[root(t[2])] = root(t[0]); triangles.push(t);
  }
  const components = new Map<number, [number, number, number][]>();
  for (const t of triangles) { const id = root(t[0]); const list = components.get(id) ?? []; list.push(t); components.set(id, list); }
  const result: THREE.BufferGeometry[] = [];
  try {
    for (const tris of components.values()) {
      const edgeCounts = new Map<string, { count: number; a: number; b: number }>();
      for (const t of tris) for (let j = 0; j < 3; j++) {
        const a = t[j]!, b = t[(j + 1) % 3]!, key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const edge = edgeCounts.get(key); if (edge) edge.count++; else edgeCounts.set(key, { count: 1, a, b });
      }
      if ([...edgeCounts.values()].some(e => e.count > 2)) throw new Error('Nature collision component is non-manifold');
      const open = [...edgeCounts.values()].filter(e => e.count === 1), next = new Map<number, number>();
      for (const e of open) { if (next.has(e.a)) throw new Error('Ambiguous open nature boundary'); next.set(e.a, e.b); }
      const values: number[] = [];
      for (const t of tris) for (const i of t) values.push(...vertices[i]!.toArray());
      while (next.size) {
        const start = next.keys().next().value as number, loop: number[] = []; let at = start;
        do {
          loop.push(at); const to = next.get(at); if (to === undefined) throw new Error('Nature boundary is not a ring');
          next.delete(at); at = to;
          if (loop.length > open.length) throw new Error('Nature boundary loop overflow');
        } while (at !== start);
        if (loop.length < 3) throw new Error('Nature boundary is degenerate');
        const center = new THREE.Vector3(); for (const id of loop) center.add(vertices[id]!); center.divideScalar(loop.length);
        // Reverse the existing directed boundary to preserve outward orientation.
        for (let i = 0; i < loop.length; i++) values.push(...vertices[loop[(i + 1) % loop.length]!]!.toArray(),
          ...vertices[loop[i]!]!.toArray(), ...center.toArray());
      }
      const solid = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      solid.computeVertexNormals(); solid.computeBoundingBox(); result.push(solid);
    }
    return result;
  } catch (error) { result.forEach(g => g.dispose()); throw error; }
}

export interface NatureBatch {
  readonly visual: THREE.Group;
  readonly colliders: THREE.Group;
  readonly stats: { instances: number; visibleBatches: number; triangles: number; colliderMeshes: number; collisionTriangles: number };
  dispose(): void;
}
export interface CampusNatureAssets {
  readonly status: 'ready';
  readonly atlasGpuBytes: number;
  createBatch(placements: readonly NaturePlacement[]): NatureBatch;
  /** Marks library for disposal. Live batches retain their borrowed geometry/material. */
  dispose(): void;
}

/** Takes ownership on SUCCESS only. Also supports CPU asset validation without a renderer. */
export function createCampusNatureAssets(
  geometries: Record<NatureKind, THREE.BufferGeometry>, material: THREE.MeshStandardMaterial,
): CampusNatureAssets {
  const solids = {} as Record<NatureKind, THREE.BufferGeometry[]>;
  try {
    for (const kind of kinds) {
      const g = geometries[kind], expected = NATURE_MODEL_BOUNDS[kind];
      if (!g || (g.index?.count ?? g.getAttribute('position')?.count ?? 0) / 3 !== expected.triangles)
        throw new Error(`Unexpected ${kind} geometry budget`);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      for (const [actual, target] of [[b.min, expected.min], [b.max, expected.max]] as const)
        if (actual.distanceTo(new THREE.Vector3(...target)) > 1e-4) throw new Error(`Unexpected ${kind} geometry bounds`);
      // Low grass is soft decoration. All woody/closed shrub components have real solids.
      solids[kind] = kind === 'grass' ? [] : createNatureCollisionGeometries(g);
    }
  } catch (error) { Object.values(solids).flat().forEach(g => g.dispose()); throw error; }
  if (material.map) { material.map.colorSpace = THREE.SRGBColorSpace; material.map.needsUpdate = true; }
  material.name = 'KayKit forest CC0 shared';
  harmonizeNatureAlbedo(material);
  const collisionMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  let active = 0, requested = false, disposed = false;
  const finish = () => {
    if (!requested || active || disposed) return;
    disposed = true; new Set(Object.values(geometries)).forEach(g => g.dispose());
    Object.values(solids).flat().forEach(g => g.dispose());
    material.map?.dispose(); material.dispose(); collisionMaterial.dispose();
  };
  return {
    status: 'ready', atlasGpuBytes: NATURE_ATLAS_GPU_BYTES,
    createBatch(placements) {
      if (requested) throw new Error('Nature asset library was disposed');
      // Validate the entire request before allocating any instance buffers.
      const prepared = placements.map(p => ({ p, matrix: placementMatrix(p) }));
      const visual = new THREE.Group(), colliders = new THREE.Group();
      visual.name = 'campus-arrival-nature'; colliders.name = 'campus-arrival-nature-solids';
      const meshes: THREE.InstancedMesh[] = [];
      const stats = { instances: placements.length, visibleBatches: 0, triangles: 0, colliderMeshes: 0, collisionTriangles: 0 };
      try {
        for (const kind of kinds) {
          const entries = prepared.filter(({ p }) => p.kind === kind); if (!entries.length) continue;
          const mesh = new THREE.InstancedMesh(geometries[kind], material, entries.length); meshes.push(mesh);
          mesh.name = `kaykit-${kind}`; mesh.castShadow = kind !== 'grass'; mesh.receiveShadow = true;
          mesh.userData.natureKind = kind; mesh.userData.source = 'KayKit Forest Nature Pack CC0';
          entries.forEach(({ p, matrix }, i) => {
            mesh.setMatrixAt(i, matrix);
            for (const geometry of solids[kind]) {
              const collider = new THREE.Mesh(geometry, collisionMaterial); collider.matrixAutoUpdate = false;
              collider.matrix.copy(matrix); collider.name = p.id ?? `nature-${kind}-${i}`; colliders.add(collider);
              stats.collisionTriangles += geometry.getAttribute('position').count / 3;
            }
          });
          mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); visual.add(mesh);
          stats.triangles += entries.length * NATURE_MODEL_BOUNDS[kind].triangles;
        }
      } catch (error) { meshes.forEach(m => m.dispose()); throw error; }
      visual.updateMatrixWorld(true); colliders.updateMatrixWorld(true);
      stats.visibleBatches = meshes.length; stats.colliderMeshes = colliders.children.length; active++;
      let released = false;
      return { visual, colliders, stats, dispose() {
        if (released) return; released = true;
        visual.removeFromParent(); colliders.removeFromParent(); visual.clear(); colliders.clear();
        meshes.forEach(m => m.dispose()); active--; finish();
      } };
    },
    dispose() { requested = true; finish(); },
  };
}

function disposeLoadedScene(scene: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  scene.traverse(o => { if (o instanceof THREE.Mesh) {
    geometries.add(o.geometry);
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(mat); const map = (mat as THREE.MeshStandardMaterial).map; if (map) textures.add(map);
    }
  } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

/** One local, self-contained GLB; no CDN, extra RAF, or global mutable cache.
 * Fetch aborts immediately. If cancellation occurs during image decode, late assets
 * are disposed before rejection, never attached. Caller must guard campus generation. */
export async function loadCampusNatureAssets(options: { signal?: AbortSignal } = {}): Promise<CampusNatureAssets> {
  const { signal } = options; signal?.throwIfAborted();
  const response = await fetch(CAMPUS_NATURE_URL, { signal });
  if (!response.ok) throw new Error(`Campus nature assets unavailable (${response.status}); keep base scenery`);
  const bytes = await response.arrayBuffer(); signal?.throwIfAborted();
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  try {
    signal?.throwIfAborted();
    const geometries = {} as Record<NatureKind, THREE.BufferGeometry>;
    let material: THREE.MeshStandardMaterial | undefined;
    for (const kind of kinds) {
      const object = gltf.scene.getObjectByName(kind);
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)
        || !object.matrix.equals(new THREE.Matrix4())) throw new Error(`Campus nature model ${kind} is invalid`);
      geometries[kind] = object.geometry;
      if (material && object.material !== material) throw new Error('Campus nature atlas material must be shared');
      material = object.material;
    }
    return createCampusNatureAssets(geometries, material!);
  } catch (error) { disposeLoadedScene(gltf.scene); throw error; }
}
