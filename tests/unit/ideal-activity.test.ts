import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { hasIdealActivityLineOfSight, idealActivityEligibility } from '../../src/scene/CampusScene';
import { createIdealCampusLayer, IDEAL_ACTIVITY_POINTS } from '../../src/scene/IdealCampusLayer';

const eligible = { free: true, grounded: true, withinFacility: true, distance: 1.4, obstructed: false };
describe('original public space interaction gates', () => {
  it('requires free exploration, stable ground, range, inside facility and clear view together', () => {
    expect(idealActivityEligibility(eligible).available).toBe(true);
    for (const patch of [{ free: false }, { grounded: false }, { withinFacility: false }, { distance: 2.401 }, { distance: NaN }, { distance: Infinity }, { distance: -1 }, { obstructed: true }]) {
      const result = idealActivityEligibility({ ...eligible, ...patch });
      expect(result.available).toBe(false); expect(result.reason.length).toBeGreaterThan(0);
    }
    expect(idealActivityEligibility({ ...eligible, distance: 2.4 }).available).toBe(true);
  });
  it('uses real opaque geometry, honors invisible ancestors, and resets ray length', () => {
    const world = new Group(), branch = new Group(); world.add(branch);
    const blocker = new Mesh(new BoxGeometry(.2, 2, 2), new MeshBasicMaterial()); branch.add(blocker); world.updateMatrixWorld(true);
    const ray = new Raycaster(), from = new Vector3(-1, 0, 0), to = new Vector3(1, 0, 0);
    expect(hasIdealActivityLineOfSight(from, to, [world], ray)).toBe(false);
    expect(ray.far).toBe(Infinity);
    branch.visible = false; expect(hasIdealActivityLineOfSight(from, to, [world], ray)).toBe(true);
    branch.visible = true; branch.userData.photoIgnore = true; expect(hasIdealActivityLineOfSight(from, to, [world], ray)).toBe(true);
    expect(hasIdealActivityLineOfSight(from, from, [world], ray)).toBe(false);
    blocker.geometry.dispose(); blocker.material.dispose();
  });
  for (const campus of ['huyu', 'yingxi'] as const) it(`${campus} desk target is visible from its real ground approach without moving state`, () => {
    const layer = createIdealCampusLayer(campus), point = IDEAL_ACTIVITY_POINTS[campus];
    layer.visual.updateMatrixWorld(true);
    const from = new Vector3(point.approach[0], 1.62, point.approach[1]);
    const to = new Vector3(...point.target);
    const before = JSON.stringify(layer.visual.position.toArray());
    expect(hasIdealActivityLineOfSight(from, to, [layer.visual])).toBe(true);
    expect(Math.hypot(from.x - to.x, from.z - to.z)).toBeLessThanOrEqual(2.4);
    expect(JSON.stringify(layer.visual.position.toArray())).toBe(before);
    layer.dispose();
  });
});
