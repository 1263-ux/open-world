import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Original, low-contrast surface details for the campus. UV coordinates are in
 * world metres: 1 UV unit = 1 metre. No photographs or external assets.
 *
 * Color-map handling follows Three's color-management and texture manuals:
 * https://threejs.org/manual/pages/color-management.html
 * https://threejs.org/manual/pages/textures.html (reviewed 2026-10-30)
 */
export type SurfaceKind = 'grass' | 'asphalt' | 'paving';
const TILE_METRES: Record<SurfaceKind, number> = { grass: 8, asphalt: 6, paving: 4 };

/** Fixed seed to avoid a different world every time a campus is loaded. */
function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Draw across the canvas seams too, so repeated small marks don't cut off. */
function wrappedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number): void {
  const xs = [x], ys = [y];
  if (x < 0) xs.push(x + size); else if (x + w > size) xs.push(x - size);
  if (y < 0) ys.push(y + size); else if (y + h > size) ys.push(y - size);
  for (const px of xs) for (const py of ys) ctx.fillRect(px, py, w, h);
}

function createTexture(kind: SurfaceKind): THREE.CanvasTexture | null {
  // The fallback is useful for unavailable canvas contexts and non-browser tests.
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const size = kind === 'paving' ? 256 : 128;
  canvas.width = canvas.height = size;
  let ctx: CanvasRenderingContext2D | null;
  try { ctx = canvas.getContext('2d'); } catch { return null; }
  if (!ctx) return null;
  const random = randomGenerator(kind === 'grass' ? 1081 : kind === 'asphalt' ? 331 : 773);
  if (kind === 'paving') {
    // 4m texture tile = eight 0.5m courses; alternate joints half a paver.
    // Repeated wrapping with an even number of rows maintains the bond pattern.
    ctx.fillStyle = '#dfddd7'; ctx.fillRect(0, 0, size, size);
    const paver = size / 8;
    for (let row = 0; row < 8; row++) {
      const shift = row % 2 ? paver / 2 : 0;
      for (let col = -1; col < 8; col++) {
        // Hash wrapped column indices: both clipped halves have the same tone.
        const c = ((col % 8) + 8) % 8;
        const shade = [244, 247, 250, 245, 248][(row * 7 + c * 3) % 5];
        ctx.fillStyle = `rgb(${shade},${shade - 1},${shade - 4})`;
        ctx.fillRect(col * paver + shift + 0.6, row * paver + 0.6, paver - 1.2, paver - 1.2);
      }
    }
    for (let i = 0; i < 850; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(120,112,99,0.035)' : 'rgba(255,255,255,0.075)';
      wrappedRect(ctx, random() * size, random() * size, 1, 1, size);
    }
  } else {
    ctx.fillStyle = kind === 'grass' ? '#f7f8f3' : '#f7f7f4';
    ctx.fillRect(0, 0, size, size);
    // Fine-scale marks are tonal and sparse; no broad blotchy noise layer.
    const count = kind === 'grass' ? 1150 : 1600;
    for (let i = 0; i < count; i++) {
      const x = random() * size, y = random() * size;
      if (kind === 'grass') {
        ctx.fillStyle = i % 3 ? 'rgba(108,132,101,0.07)' : 'rgba(255,255,241,0.15)';
        wrappedRect(ctx, x, y, 0.7 + random() * 0.6, 1 + random() * 1.8, size);
      } else {
        ctx.fillStyle = i % 3 ? 'rgba(100,101,94,0.055)' : 'rgba(255,255,255,0.11)';
        wrappedRect(ctx, x, y, 0.8, 0.8, size);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `campus-${kind}-original`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.setScalar(1 / TILE_METRES[kind]);
  return texture;
}

/** Share each returned material across compatible meshes and dispose on teardown. */
export function createSurfaceMaterial(kind: SurfaceKind, color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const map = createTexture(kind);
  return new THREE.MeshStandardMaterial({ color, roughness: 1, ...(map ? { map } : {}) });
}

/** Two original, branch-directed crown silhouettes, baked once per instance
 * batch. Four overlapping closed volumes avoid leaf-card noise/overdraw. Lower
 * growth tapers toward the trunk rather than completing a spherical underside.
 * No botanical species or measured reconstruction is implied. Local metres,
 * origin and the previous crown envelope are retained; callers own instancing. */
export type FoliageVariant = 0 | 1;

/** Stable world-position variation; adding/reordering trees cannot reshuffle it.
 * Yaw stays zero: even a half-turn would widen the current asymmetric local
 * envelope. Existing per-tree scales remain the caller's upper bound. */
export function getFoliageVariation(x: number, z: number): {
  variant: FoliageVariant; yaw: number; colorScale: number;
} {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Foliage position must be finite');
  let hash = Math.imul(Math.round(x * 100), 0x45d9f3b) ^ Math.imul(Math.round(z * 100), 0x27d4eb2d);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return { variant: (hash & 1) as FoliageVariant, yaw: 0,
    colorScale: .97 + ((hash >>> 8) & 255) / 255 * .06 };
}

export function createFoliageGeometry(variant: FoliageVariant = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = variant === 0 ? [
    { center: [-.10, .02, .00], scale: [.60, .65, .56] },
    { center: [-.43, .04, .08], scale: [.48, .43, .62] },
    { center: [.44, .17, .30], scale: [.49, .40, .54] },
    { center: [.01, .04, -.40], scale: [.58, .46, .56] },
  ] : [
    { center: [.12, -.01, -.04], scale: [.53, .68, .60] },
    { center: [-.43, .12, -.13], scale: [.43, .42, .53] },
    { center: [.45, .06, .24], scale: [.43, .45, .64] },
    { center: [-.08, .23, -.44], scale: [.52, .42, .47] },
  ];
  lobes.forEach(({ center, scale }, index) => {
    // Detail 2 is 180 triangles. Displacement depends only on direction, so
    // coincident vertices remain coincident and each volume stays watertight.
    const crown = new THREE.IcosahedronGeometry(1, 2);
    const position = crown.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const phase = index * 1.7 + variant * 2.1;
      const ripple = 1 + .075 * Math.sin(x * 7 + phase) * Math.cos(z * 6 - y * 4)
        + .035 * Math.sin(y * 9 + z * 5 + phase);
      const taper = 1 - .38 * Math.pow(Math.max(0, -y), 1.4);
      // A broad upper branch and a different lateral lean per lobe make the
      // silhouette read as growth, not an array of complete round balls.
      const lean = Math.max(0, y) * .09 * (index % 2 ? -1 : 1);
      const px = center[0] + (x * taper + lean) * scale[0] * ripple;
      const py = center[1] + y * scale[1] * ripple;
      const pz = center[2] + (z * taper + lean * (variant ? 1 : -.5)) * scale[2] * ripple;
      position.setXYZ(i, px * .99, py, pz * .985);
      const upper = THREE.MathUtils.clamp((py + .7) / 1.4, 0, 1);
      const shade = .78 + upper * .16 + .025 * Math.sin(px * 5 + pz * 3);
      colors[i * 3] = shade * (.96 + upper * .04);
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade * (.91 - upper * .02);
    }
    crown.computeVertexNormals();
    // The geometry is non-indexed for batching. Average coincident normals
    // within each closed lobe so the crown reads as soft foliage, not cut rock.
    // Lobes remain separate; their asymmetric silhouette is not smoothed away.
    const normals = crown.getAttribute('normal');
    const sums = new Map<string, THREE.Vector3>();
    const keys: string[] = [];
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => v.toFixed(6)).join(',');
      keys.push(key);
      const sum = sums.get(key) ?? new THREE.Vector3();
      sum.x += normals.getX(i); sum.y += normals.getY(i); sum.z += normals.getZ(i);
      sums.set(key, sum);
    }
    for (const sum of sums.values()) sum.normalize();
    for (let i = 0; i < position.count; i++) {
      const normal = sums.get(keys[i])!;
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    crown.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(crown);
  });
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('Unable to merge original foliage geometry');
  merged.name = `campus-original-branch-crown-${variant}`;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
