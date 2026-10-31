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

/** Original fine leaf clusters, baked once and instanced per tree. The sparse
 * opaque cards avoid alpha overdraw while keeping a broken, leafy silhouette.
 * All trees share this geometry; random variation is deterministic. */
export function createFoliageGeometry(): THREE.BufferGeometry {
  const random = randomGenerator(3771);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 200; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * .95;
    const leaf = new THREE.PlaneGeometry(.20 + random() * .09, .09 + random() * .05);
    leaf.rotateX(random() * Math.PI);
    leaf.rotateY(random() * Math.PI * 2);
    leaf.rotateZ(random() * Math.PI);
    leaf.translate(Math.cos(angle) * radius, (random() - .5) * 1.35, Math.sin(angle) * radius);
    const shade = .8 + random() * .2;
    const values = new Float32Array(leaf.getAttribute('position').count * 3);
    for (let j = 0; j < values.length; j += 3) {
      values[j] = shade; values[j + 1] = Math.min(1, shade * 1.02); values[j + 2] = shade * .95;
    }
    leaf.setAttribute('color', new THREE.BufferAttribute(values, 3));
    parts.push(leaf);
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('Unable to merge original foliage geometry');
  merged.name = 'campus-original-fine-leaves';
  return merged;
}
