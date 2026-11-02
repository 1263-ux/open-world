import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, Material, Mesh, MeshBasicMaterial } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { campuses } from '../../src/campus-data/campuses';
import { PlayerController } from '../../src/scene/PlayerController';
import { commitCampusModeLayer, disposeObject } from '../../src/scene/CampusScene';
import { createIdealCampusLayer, IDEAL_FACILITIES } from '../../src/scene/IdealCampusLayer';
import { StudentModel } from '../../src/scene/StudentModel';
import { ElementDouble } from './controller-harness';

// Reconstructed candidate: CPU Octree/transaction tests, not renderer/browser proof.
let player: PlayerController;
const empty = { ...campuses.yingxi, features: [], modelObstacles: [], boundary: [] };
const frames = (n = 30) => { for (let i = 0; i < n; i++) player.update(1 / 60); };
function pose() { return { xyz: player.avatar.position.toArray(), camera: player.camera.position.toArray(), quaternion: player.camera.quaternion.toArray(), shadow: player.shadow.position.toArray(), yaw: (player as unknown as { yaw: number }).yaw, pitch: (player as unknown as { pitch: number }).pitch }; }
function box(x = 5, y = 1, z = 0, w = 1, h = 2, d = 1) { const group = new Group(); const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial()); mesh.position.set(x, y, z); group.add(mesh); return group; }
function prepare(group: Group) { const snapshot = player.prepareCollision(empty, group); disposeObject(group); return snapshot; }
function layer() { return { visual: new Group(), dispose: vi.fn() }; }
function key(code: string) { (player as unknown as { onKeyDown(e: KeyboardEvent): void }).onKeyDown({ code, target: null, repeat: false, preventDefault() {} } as KeyboardEvent); }
function sameSnapshot(snapshot: ReturnType<PlayerController['getCollisionSnapshot']>) { expect(player.getCollisionSnapshot().octree).toBe(snapshot.octree); expect(player.getCollisionSnapshot().solidVolumes).toBe(snapshot.solidVolumes); }
beforeEach(() => {
  vi.stubGlobal('Element', ElementDouble); vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: () => new ElementDouble() })); vi.stubGlobal('window', new EventTarget());
  vi.spyOn(performance, 'now').mockReturnValue(0); vi.spyOn(StudentModel, 'load').mockReturnValue(new Promise<StudentModel>(() => {}));
  player = new PlayerController(new ElementDouble() as unknown as HTMLElement, new ElementDouble() as unknown as HTMLCanvasElement);
  player.setCampus(empty); player.setPosition([0, 0]); frames(); player.updateCamera(true);
});
afterEach(() => { player.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('campus mode collision and visual transaction', () => {
  it('prepares without side effects and commits/restores exact pose with real collision rays', () => {
    const old = player.getCollisionSnapshot(), before = pose(), next = prepare(box());
    sameSnapshot(old); expect(pose()).toEqual(before); expect(player.segmentHit([3, 1, 0], [7, 1, 0])).toBeNull();
    expect(player.commitCollision(next)).toBe(true); sameSnapshot(next); expect(pose()).toEqual(before); expect(player.segmentHit([3, 1, 0], [7, 1, 0])).not.toBeNull();
    expect(player.commitCollision(old)).toBe(true); expect(pose()).toEqual(before); expect(player.segmentHit([3, 1, 0], [7, 1, 0])).toBeNull();
  });
  it('clears held inputs without advancing the old world during commit', () => {
    const controls = player as unknown as { joystick: { set(x: number, y: number): void } };
    key('KeyW'); controls.joystick.set(.4, -.8); const before = pose();
    expect(player.commitCollision(prepare(box()))).toBe(true); expect(pose()).toEqual(before); frames(60); expect(player.avatar.position.toArray()).toEqual(before.xyz);
  });
  it('rejects an enclosing solid without losing the old snapshot or pose', () => {
    const old = player.getCollisionSnapshot(), before = pose(), next = prepare(box(0, 2, 0, 5, 4, 5));
    expect(player.canCommitCollision(next)).toBe(false); expect(player.commitCollision(next)).toBe(false); sameSnapshot(old); expect(pose()).toEqual(before);
  });
  it('rejects an actual airborne jump without resetting height', () => {
    key('Space'); frames(6); expect(player.avatar.position.y).toBeGreaterThan(.3); expect(player.onSharedGround).toBe(false);
    const before = pose(), old = player.getCollisionSnapshot(); expect(player.commitCollision(prepare(box()))).toBe(false); sameSnapshot(old); expect(pose()).toEqual(before);
  });
  it('disposes owned temporary geometry/material when Octree building throws, never borrowed originals', () => {
    const props = box(), mesh = props.children[0] as Mesh, borrowedGeometry = vi.spyOn(mesh.geometry, 'dispose'), borrowedMaterial = vi.spyOn(mesh.material as Material, 'dispose');
    const geometries: ReturnType<typeof vi.spyOn>[] = [], materials: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(Octree.prototype, 'fromGraphNode').mockImplementation(group => {
      const seenG = new Set<BufferGeometry>(), seenM = new Set<Material>();
      group.traverse(o => { if (o instanceof Mesh) { if (!seenG.has(o.geometry)) { seenG.add(o.geometry); geometries.push(vi.spyOn(o.geometry, 'dispose')); } for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m !== mesh.material && !seenM.has(m)) { seenM.add(m); materials.push(vi.spyOn(m, 'dispose')); } } });
      throw new Error('octree preparation fault');
    });
    const before = pose(), old = player.getCollisionSnapshot();
    const campus = { ...empty, boundary: [[-20, -20], [20, -20], [20, 20], [-20, 20]] as [number, number][] };
    expect(() => player.prepareCollision(campus, props)).toThrow('octree preparation fault');
    sameSnapshot(old); expect(pose()).toEqual(before); expect(geometries.length).toBeGreaterThan(1); expect(materials.length).toBe(1);
    for (const spy of [...geometries, ...materials]) expect(spy).toHaveBeenCalledTimes(1);
    expect(borrowedGeometry).not.toHaveBeenCalled(); expect(borrowedMaterial).not.toHaveBeenCalled();
    disposeObject(props);
  });
  it.each(['yingxi', 'huyu'] as const)('repeated real %s facility swaps preserve the shared-ground pose and remove ghost collision', id => {
    player.setCampus(campuses[id]); player.setPosition(IDEAL_FACILITIES[id].sharedGroundZones[0]!.center); frames(); player.updateCamera(true);
    expect(player.onSharedGround).toBe(true); const before = pose(), base = player.getCollisionSnapshot(), ideal = createIdealCampusLayer(id);
    const next = player.prepareCollision(campuses[id], ideal.colliders);
    const column = ideal.colliders.children.find(o => { const m = o as Mesh; m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox!; return Math.abs(b.min.y - .4) < .01 && Math.abs(b.max.y - 3.2) < .01; }) as Mesh;
    expect(column).toBeDefined(); const bounds = column.geometry.boundingBox!, x = (bounds.min.x + bounds.max.x) / 2, z = (bounds.min.z + bounds.max.z) / 2;
    for (let i = 0; i < 6; i++) {
      expect(player.commitCollision(next)).toBe(true); expect(pose()).toEqual(before); expect(player.pointBlocked([x, 1, z])).toBe(true);
      expect(player.commitCollision(base)).toBe(true); expect(pose()).toEqual(before); expect(player.pointBlocked([x, 1, z])).toBe(false);
    }
    ideal.dispose();
  });
  it('rolls back partial visual attachment when world.add throws', () => {
    const world = new Group(), previous = layer(), prepared = layer(); world.add(previous.visual); const old = player.getCollisionSnapshot(), before = pose();
    const add = world.add.bind(world); vi.spyOn(world, 'add').mockImplementation((...objects) => { add(...objects); throw new Error('attach fault'); });
    expect(commitCampusModeLayer(world, player, prepare(box()), previous, prepared).applied).toBe(false);
    sameSnapshot(old); expect(pose()).toEqual(before); expect(previous.visual.parent).toBe(world); expect(prepared.visual.parent).toBeNull(); expect(prepared.dispose).toHaveBeenCalledOnce(); expect(previous.dispose).not.toHaveBeenCalled();
  });
  it('rolls back visual attachment when collision commit returns false', () => {
    const world = new Group(), previous = layer(), prepared = layer(); world.add(previous.visual); const old = player.getCollisionSnapshot(); vi.spyOn(player, 'commitCollision').mockReturnValue(false);
    expect(commitCampusModeLayer(world, player, prepare(box()), previous, prepared)).toEqual({ applied: false, cleanupWarning: false });
    sameSnapshot(old); expect(world.children).toEqual([previous.visual]); expect(prepared.dispose).toHaveBeenCalledOnce();
  });
  it('restores collision references even when commit throws after swapping them', () => {
    const world = new Group(), previous = layer(), prepared = layer(); world.add(previous.visual); const old = player.getCollisionSnapshot(), before = pose(), commit = player.commitCollision.bind(player);
    vi.spyOn(player, 'commitCollision').mockImplementation(next => { commit(next); throw new Error('post swap'); });
    expect(commitCampusModeLayer(world, player, prepare(box()), previous, prepared).applied).toBe(false); sameSnapshot(old); expect(pose()).toEqual(before); expect(world.children).toEqual([previous.visual]);
  });
  it('reports rollback cleanup failure without replacing the old world', () => {
    const world = new Group(), previous = layer(), prepared = layer(); world.add(previous.visual); const old = player.getCollisionSnapshot(); prepared.dispose.mockImplementation(() => { throw new Error('dispose fault'); }); vi.spyOn(player, 'commitCollision').mockReturnValue(false);
    expect(commitCampusModeLayer(world, player, prepare(box()), previous, prepared)).toEqual({ applied: false, cleanupWarning: true }); sameSnapshot(old); expect(world.children).toEqual([previous.visual]);
  });
  it('keeps the successful new world if old resource cleanup throws', () => {
    const world = new Group(), previous = layer(), prepared = layer(); world.add(previous.visual); const next = prepare(box()); previous.dispose.mockImplementation(() => { throw new Error('old cleanup'); });
    expect(commitCampusModeLayer(world, player, next, previous, prepared)).toEqual({ applied: true, cleanupWarning: true }); sameSnapshot(next); expect(world.children).toEqual([prepared.visual]); expect(prepared.dispose).not.toHaveBeenCalled();
  });
  it('removes the ideal layer and restores base collision atomically', () => {
    const world = new Group(), ideal = layer(), base = player.getCollisionSnapshot(); world.add(ideal.visual); player.commitCollision(prepare(box())); const before = pose();
    expect(commitCampusModeLayer(world, player, base, ideal, null)).toEqual({ applied: true, cleanupWarning: false }); sameSnapshot(base); expect(world.children).toHaveLength(0); expect(pose()).toEqual(before); expect(ideal.dispose).toHaveBeenCalledOnce();
  });
});
