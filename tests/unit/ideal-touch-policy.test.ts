import { expect, it } from 'vitest';
import { compactTouchRoute } from '../e2e/ideal-activity-helpers';
import { walkRoute } from '../e2e/campus-walk';
import { campuses } from '../../src/campus-data/campuses';

it('preserves every turn, reversal, duplicate and endpoints without mutating the route', () => {
  const route: [number,number][] = [[0,0],[2,0],[4,0],[4,2],[4,4],[4,2],[4,2],[6,4],[8,6]];
  const saved = structuredClone(route);
  expect(compactTouchRoute(route)).toEqual([[0,0],[4,0],[4,4],[4,2],[4,2],[8,6]]);
  expect(route).toEqual(saved);
  expect(compactTouchRoute([])).toEqual([]);
});
it('retains the exact failed A* polyline geometry and first off-grid approach', () => {
  const route = walkRoute(campuses.yingxi, [-23.001,175.5], [54,172]);
  const compact = compactTouchRoute(route);
  expect(compact).toEqual([[-22,176],[46,176],[48,174],[52,174],[54,172],[54,172]]);
  const length = (points:[number,number][]) => points.slice(1).reduce((sum,p,i) => sum + Math.hypot(p[0]-points[i]![0],p[1]-points[i]![1]),0);
  expect(length(compact)).toBeCloseTo(length(route),12);
});
