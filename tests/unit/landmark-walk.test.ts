import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { landmarkRoute } from '../e2e/landmark-walk';
import type { CampusData, Point2 } from '../../src/shared/contracts';

describe('authored landmark input route', () => {
  for (const campus of Object.values(campuses)) it(`${campus.id}: matches Scene suffix and retains corners with <=2m steps`, () => {
    for (const landmark of campus.landmarks) {
      const start = campus.start; let distance = Infinity, expected: Point2[] = [landmark.arrival];
      for (const [key, points] of Object.entries(campus.routes)) if (key.endsWith(`>${landmark.id}`)) {
        points.forEach((p, i) => { const d = Math.hypot(p[0] - start[0], p[1] - start[1]); if (d < distance) { distance = d; expected = points.slice(i); } });
      }
      const route = landmarkRoute(campus, start, landmark.id);
      let previous = start;
      for (const point of route) { expect(Math.hypot(point[0] - previous[0], point[1] - previous[1])).toBeLessThanOrEqual(2 + 1e-9); previous = point; }
      for (const corner of expected) expect(route.some(p => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 1e-9)).toBe(true);
      expect(route.at(-1)).toEqual(expected.at(-1));
    }
  });
  it('keeps deterministic first-route ties and ignores invalid suffixes', () => {
    const c = { ...campuses.yingxi, routes: { 'a>yx-garden': [[0,0],[NaN,2]], 'b>yx-garden': [[0,1],[3,1]], 'c>yx-garden': [[0,-1],[4,-1]] } } as CampusData;
    expect(landmarkRoute(c, [0,0], 'yx-garden').at(-1)).toEqual([3,1]);
  });
  it('fails closed for unknown targets or nonfinite input', () => {
    expect(() => landmarkRoute(campuses.yingxi, [0,0], 'missing')).toThrow();
    expect(() => landmarkRoute(campuses.yingxi, [NaN,0], 'yx-garden')).toThrow();
  });
});
