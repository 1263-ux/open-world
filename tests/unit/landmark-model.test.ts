import { expect, it } from 'vitest';
import metadata from '../../public/assets/campuses/yingxi/mechanical-hall.metadata.json' with { type: 'json' };
import { campuses } from '../../src/campus-data/campuses';

it('keeps the authored landmark anchored to its exact source footprint with explicit estimated height', () => {
  const building = campuses.yingxi.features.find(f => f.id === '182055474')!;
  expect(metadata.source_polygon).toEqual(building.polygon.slice(0, -1));
  expect(metadata.coordinate_system).toContain('meters');
  expect(metadata.height_status).toContain('not survey');
  expect(metadata.height_m).toBe(building.height);
  expect(metadata.glb_bytes).toBeLessThan(1000000);
  expect(metadata.glb_triangles).toBeLessThan(5000);
  expect(campuses.yingxi.landmarks.find(l => l.id === 'yx-mechanical')?.visualSource).toMatch(/^https:\/\/www.tyut.edu.cn\//);
});
