import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';
import {
  createCampusNatureAssets, createNatureCollisionGeometries, getNaturePlacementBounds,
  loadCampusNatureAssets, NATURE_ATLAS_GPU_BYTES, type NatureKind,
} from '../../src/scene/CampusNatureAssets';

const parseMock = vi.hoisted(() => vi.fn());
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { parseAsync = parseMock; } }));
afterEach(() => { vi.unstubAllGlobals(); parseMock.mockReset(); });

function sources() {
  const bytes = readFileSync(new URL('../../public/models/nature/campus-nature.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12), j = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const geometries = {} as Record<NatureKind, THREE.BufferGeometry>;
  for (const mesh of j.meshes) {
    const geometry = new THREE.BufferGeometry(), primitive = mesh.primitives[0];
    for (const [attribute, id] of Object.entries({ ...primitive.attributes, INDEX: primitive.indices })) {
      const a = j.accessors[id as number], view = j.bufferViews[a.bufferView];
      const count = ({ SCALAR: 1, VEC2: 2, VEC3: 3 } as Record<string, number>)[a.type]!;
      const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
      const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength), values: number[] = [];
      for (let i = 0; i < a.count; i++) for (let c = 0; c < count; c++) {
        const offset = view.byteOffset + (a.byteOffset ?? 0) + i * (view.byteStride ?? count * size) + c * size;
        values.push(a.componentType === 5126 ? data.getFloat32(offset, true) : size === 4 ? data.getUint32(offset, true) : data.getUint16(offset, true));
      }
      if (attribute === 'INDEX') geometry.setIndex(values);
      else geometry.setAttribute(({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' } as Record<string, string>)[attribute]!, new THREE.Float32BufferAttribute(values, count));
    }
    geometries[mesh.name as NatureKind] = geometry;
  }
  return { geometries, bytes, json: j };
}
function material() { return new THREE.MeshStandardMaterial({ map: new THREE.DataTexture(new Uint8Array([90, 120, 65, 255]), 1, 1) }); }
function mockScene() {
  const { geometries } = sources(), mat = material(), scene = new THREE.Group();
  for (const [kind, g] of Object.entries(geometries)) { const m = new THREE.Mesh(g, mat); m.name = kind; scene.add(m); }
  return { scene, mat, geometries };
}
function fetchSuccess() { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })); }

describe('licensed campus nature subset', () => {
  it('keeps provenance, original texture, five meshes and bounded network/GPU cost', () => {
    const { json, bytes, geometries } = sources();
    const proof = JSON.parse(readFileSync(new URL('../../public/models/nature/PROVENANCE.json', import.meta.url), 'utf8'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(proof.derived.sha256);
    expect(bytes.length).toBeLessThan(175_000); expect(json.meshes).toHaveLength(5); expect(json.materials).toHaveLength(1);
    expect(json.images).toHaveLength(1); expect(json.images[0].uri).toBeUndefined();
    expect(readFileSync(new URL('../../public/models/nature/License.txt', import.meta.url), 'utf8')).toMatch(/CC0/);
    expect(NATURE_ATLAS_GPU_BYTES).toBeLessThan(5.34 * 1024 * 1024);
    Object.values(geometries).forEach(g => g.dispose());
  });
  it('retains original model dimensions, root origin, UV and all visible triangles', () => {
    const { geometries } = sources(); const lib = createCampusNatureAssets(geometries, material());
    const batch = lib.createBatch([{ kind: 'tree-round', position: [10, 0, -7], scale: 1, rotationY: .7 }, { kind: 'tree-round', position: [20, 0, -7], scale: .8 }, { kind: 'grass', position: [0, 0, 0], scale: 1 }]);
    expect(batch.stats.instances).toBe(3); expect(batch.stats.visibleBatches).toBe(2); expect(batch.stats.triangles).toBe(636 * 2 + 132);
    expect(batch.visual.children[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect((batch.visual.children[0] as THREE.Mesh).geometry).toBe(geometries['tree-round']);
    expect(geometries['tree-round'].getAttribute('uv').count).toBeGreaterThan(0);
    expect(getNaturePlacementBounds({ kind: 'tree-round', position: [0, 0, 0], scale: 1 }).min.y).toBeLessThan(0);
    const tree = new THREE.Box3().setFromObject(batch.visual.children[0]!);
    expect(tree.containsBox(getNaturePlacementBounds({ kind: 'tree-round', position: [10, 0, -7], scale: 1, rotationY: .7 }).expandByScalar(-1e-4))).toBe(true);
    batch.dispose(); lib.dispose();
  });
  it('closes each true solid separately, with no filled canopy/trunk bounding box', () => {
    const { geometries } = sources();
    for (const kind of ['tree-round', 'tree-tall', 'tree-spreading', 'shrub'] as NatureKind[]) {
      const components = createNatureCollisionGeometries(geometries[kind]); expect(components.length).toBeGreaterThan(0);
      for (const g of components) {
        const positions = g.getAttribute('position'), edges = new Map<string, number>();
        const key = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(x => Math.round(x * 1e5)).join(',');
        for (let i = 0; i < positions.count; i += 3) for (let k = 0; k < 3; k++) {
          const edge = [key(i + k), key(i + (k + 1) % 3)].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
        expect([...edges.values()].every(n => n === 2), kind).toBe(true); g.dispose();
      }
    }
    Object.values(geometries).forEach(g => g.dispose());
  });
  it('has trunk collision at its real root while allowing space beneath an outer crown', () => {
    const { geometries } = sources(); const lib = createCampusNatureAssets(geometries, material());
    const batch = lib.createBatch([{ kind: 'tree-round', position: [0, 0, 0], scale: 1 }, { kind: 'grass', position: [10, 0, 0], scale: 1 }]);
    const octree = new Octree().fromGraphNode(batch.colliders);
    const cap = (x: number, z: number) => new Capsule(new THREE.Vector3(x, .47, z), new THREE.Vector3(x, 1.52, z), .34);
    expect(octree.capsuleIntersect(cap(0, 0))).not.toBe(false);
    expect(octree.capsuleIntersect(cap(-1.5, 0))).toBe(false);
    expect(octree.capsuleIntersect(cap(10, 0))).toBe(false);
    expect(batch.visual.children.every(o => !o.userData.photoIgnore)).toBe(true);
    batch.dispose(); lib.dispose();
  });
  it('keeps shared GPU resources alive across batches and frees each exactly once', () => {
    const { geometries } = sources(), mat = material(), atlas = mat.map!;
    const gs = Object.values(geometries).map(g => vi.spyOn(g, 'dispose')), ms = vi.spyOn(mat, 'dispose'), ts = vi.spyOn(atlas, 'dispose');
    const lib = createCampusNatureAssets(geometries, mat);
    const one = lib.createBatch([{ kind: 'tree-round', position: [0, 0, 0], scale: 1 }]);
    const two = lib.createBatch([{ kind: 'shrub', position: [0, 0, 0], scale: 1 }]);
    one.dispose(); one.dispose(); expect(ms).not.toHaveBeenCalled();
    lib.dispose(); lib.dispose(); expect(ts).not.toHaveBeenCalled();
    expect(() => lib.createBatch([])).toThrow(/disposed/);
    two.dispose(); two.dispose(); expect(ms).toHaveBeenCalledTimes(1); expect(ts).toHaveBeenCalledTimes(1);
    gs.forEach(g => expect(g).toHaveBeenCalledTimes(1));
  });
  it('rejects invalid placements before borrowing or allocating instances', () => {
    const { geometries } = sources(); const lib = createCampusNatureAssets(geometries, material());
    expect(() => lib.createBatch([{ kind: 'shrub', position: [NaN, 0, 0], scale: 1 }])).toThrow();
    expect(() => getNaturePlacementBounds({ kind: 'grass', position: [0, 0, 0], scale: 0 })).toThrow();
    const empty = lib.createBatch([]); expect(empty.stats.visibleBatches).toBe(0); empty.dispose(); lib.dispose();
  });
  it('loads exactly one local GLB and exposes ready state without scene attachment', async () => {
    const { scene, mat } = mockScene(); fetchSuccess(); parseMock.mockResolvedValue({ scene });
    const lib = await loadCampusNatureAssets(); expect(lib.status).toBe('ready'); expect(fetch).toHaveBeenCalledTimes(1);
    expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace); expect(scene.parent).toBeNull(); lib.dispose();
  });
  it('fails explicitly on missing files and does not pretend a blank layer is ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadCampusNatureAssets()).rejects.toThrow(/404.*keep base scenery/); expect(parseMock).not.toHaveBeenCalled();
  });
  it('rejects a pre-aborted generation before fetch', async () => {
    const controller = new AbortController(); controller.abort(); fetchSuccess();
    await expect(loadCampusNatureAssets({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(fetch).not.toHaveBeenCalled();
  });
  it('disposes late decoded resources when the campus generation was cancelled', async () => {
    const { scene, mat, geometries } = mockScene(), controller = new AbortController(); fetchSuccess();
    const ms = vi.spyOn(mat, 'dispose'), ts = vi.spyOn(mat.map!, 'dispose'), gs = Object.values(geometries).map(g => vi.spyOn(g, 'dispose'));
    parseMock.mockImplementation(async () => { controller.abort(); return { scene }; });
    await expect(loadCampusNatureAssets({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(ms).toHaveBeenCalledTimes(1); expect(ts).toHaveBeenCalledTimes(1); gs.forEach(g => expect(g).toHaveBeenCalledTimes(1));
  });
  it('cleans malformed decoded assets rather than admitting wrong bounding boxes', async () => {
    const { scene, mat, geometries } = mockScene(); geometries.shrub.scale(2, 2, 2); fetchSuccess(); parseMock.mockResolvedValue({ scene });
    const ms = vi.spyOn(mat, 'dispose'); await expect(loadCampusNatureAssets()).rejects.toThrow(/bounds/); expect(ms).toHaveBeenCalledTimes(1);
  });
});
