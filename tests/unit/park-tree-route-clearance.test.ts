import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { PARK_TREE_ROUTE_CLEARANCE, parkTreeClearsAuthoredRoutes } from '../../src/scene/CampusScene';

describe('generated park trunks protect authored pedestrian corridors', () => {
  it('protects both sides, corners and zero-length route segments without mutating source', () => {
    const routes = { 'a>b': [[0, 0], [10, 0], [10, 10], [10, 10]] } as typeof campuses.yingxi.routes;
    const before = JSON.stringify(routes);
    expect(PARK_TREE_ROUTE_CLEARANCE).toBe(1.2 + .34 + .45 + .11);
    for (const point of [[5, 2.09], [5, -2.09], [11.4, -1.4], [10, 11]] as const) {
      expect(parkTreeClearsAuthoredRoutes([...point], routes)).toBe(false);
    }
    expect(parkTreeClearsAuthoredRoutes([5, 2.11], routes)).toBe(true);
    expect(parkTreeClearsAuthoredRoutes([12.11, 10], routes)).toBe(true);
    expect(JSON.stringify(routes)).toBe(before);
  });
  it('rejects the actual old generated trunk at the observed player contact', () => {
    expect(parkTreeClearsAuthoredRoutes([19.04, 166.31], campuses.yingxi.routes)).toBe(false);
  });
  it('does not invent a corridor for campuses without authored routes', () => {
    expect(parkTreeClearsAuthoredRoutes([19.04, 166.31], {})).toBe(true);
  });
});
