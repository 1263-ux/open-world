import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { landmarkRoute } from '../e2e/landmark-walk';
import { planCampusGuidance } from '../../src/scene/CampusGuidance';

describe('authored landmark input route', () => {
  for (const campus of Object.values(campuses)) it(`${campus.id}: matches Scene suffix and retains corners with <=2m steps`, () => {
    for (const landmark of campus.landmarks) {
      const start = campus.start;
      const plan = planCampusGuidance(campus, start, landmark.id);
      expect(plan).not.toBeNull();
      const expected = plan!.points;
      const route = landmarkRoute(campus, start, landmark.id);
      let previous = start;
      for (const point of route) { expect(Math.hypot(point[0] - previous[0], point[1] - previous[1])).toBeLessThanOrEqual(2 + 1e-9); previous = point; }
      for (const corner of expected) expect(route.some(p => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 1e-9)).toBe(true);
      expect(route.at(-1)).toEqual(expected.at(-1));
    }
  });
  it('retains the actual off-route building-safe connector, not a direct join', () => {
    const start: [number, number] = [-74.281, -11.36];
    const plan = planCampusGuidance(campuses.huyu, start, 'hy-training')!;
    expect(plan.connectorCount).toBeGreaterThan(1);
    const route = landmarkRoute(campuses.huyu, start, 'hy-training');
    for (const point of plan.points) expect(route.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-9)).toBe(true);
  });
  it('fails closed for unknown targets or nonfinite input', () => {
    expect(() => landmarkRoute(campuses.yingxi, [0,0], 'missing')).toThrow();
    expect(() => landmarkRoute(campuses.yingxi, [NaN,0], 'yx-garden')).toThrow();
  });
});
