import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { walkRoute, waypointKeys } from '../e2e/campus-walk';

describe('test-side campus walking policy', () => {
  it('never idles outside the waypoint tolerance', () => {
    for (let dx = -2; dx <= 2; dx += .05) for (let dz = -2; dz <= 2; dz += .05) {
      if (Math.hypot(dx, dz) >= .9) for (const yaw of [0, -Math.PI / 2, Math.PI, .7]) expect(waypointKeys(dx, dz, yaw).length).toBeGreaterThan(0);
    }
    expect(waypointKeys(1, 0, 0)).toEqual(['KeyA']);
    expect(waypointKeys(1, 0, Math.PI)).toEqual(['KeyD']);
  });
  it('finds a test-side route between the two scenic view points', () => {
    expect(walkRoute(campuses.yingxi, PHOTO_POINTS[0]!.position, PHOTO_POINTS[1]!.position).at(-1)).toEqual(PHOTO_POINTS[1]!.position);
  });
  it('finds collision-aware routes between chapter entries and successive arrivals', () => {
    expect(walkRoute(campuses.yingxi, [-20,175.5], campuses.yingxi.landmarks.find(l => l.id === campuses.yingxi.questOrder[0])!.arrival).length).toBeGreaterThan(0);
    for (const campus of Object.values(campuses)) {
      let previous = campus.start;
      for (const id of campus.questOrder) {
        const target = campus.landmarks.find(l => l.id === id)!.arrival;
        const route = walkRoute(campus, previous, target);
        expect(walkRoute(campus, campus.start, target).at(-1)).toEqual(target);
        expect(route.length).toBeGreaterThan(0);
        expect(route.at(-1)).toEqual(target);
        previous = target;
      }
    }
  });
});
