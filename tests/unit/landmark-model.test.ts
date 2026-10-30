import { expect, it } from 'vitest';
import metadata from '../../public/assets/campuses/yingxi/mechanical-hall.metadata.json' with { type: 'json' };
import clientModel from '../../src/campus-data/mechanical-hall-model.json' with { type: 'json' };
import { campuses } from '../../src/campus-data/campuses';

it('keeps the authored landmark anchored to its exact source footprint with explicit estimated height', () => {
  const building = campuses.yingxi.features.find(f => f.id === '182055474')!;
  expect(clientModel.centerX).toBe(metadata.centerX);
  expect(clientModel.centerZ).toBe(metadata.centerZ);
  expect(metadata.source_polygon).toEqual(building.polygon.slice(0, -1));
  expect(metadata.coordinate_system).toContain('meters');
  expect(metadata.height_status).toContain('not survey');
  expect(metadata.height_m).toBe(building.height);
  expect(metadata.glb_bytes).toBeLessThan(1000000);
  // Refined hall has recessed/independently verified details: explicit revised
  // budget only for this model (old coarse model budget was <5,000). Runtime
  // frame timing and renderer load are captured separately by browser QA.
  expect(metadata.glb_triangles).toBeLessThanOrEqual(20000);
  expect(campuses.yingxi.landmarks.find(l => l.id === 'yx-mechanical')?.visualSource).toMatch(/^https:\/\/www.tyut.edu.cn\//);
});

it('keeps Meihua as one optional group with five exact candidate footprints and an audited display estimate', async () => {
  const metadata = (await import('../../public/assets/campuses/huyu/meihua-classroom-group.metadata.json', { with: { type: 'json' } })).default;
  const audit = (await import('../../public/data/augmentation-huyu-audit.json', { with: { type: 'json' } })).default;
  const landmark = campuses.huyu.landmarks.find(l => l.id === 'hy-meihua')!;
  expect(landmark.optional).toBe(true);
  expect(landmark.featureIds).toHaveLength(5);
  expect(campuses.huyu.questOrder).toEqual(['hy-main','hy-library','hy-training']);
  for (const [id, footprint] of Object.entries(metadata.sourceFootprintsWorldXZ)) {
    const feature = campuses.huyu.features.find(f => f.id === `overture:${id}`)!;
    expect(feature.polygon).toEqual([...footprint, footprint[0]]);
    expect(feature.height).toBe(4.5);
    expect(feature.heightStatus).toBe('unverified');
    expect(feature.heightSource?.source).toBe(metadata.sourceURLs.officialPhotoPage);
    const override = audit.visualOverrides.find(o => o.featureId === feature.id)!;
    expect(override.before.heightStatus).toBe('ml-estimate');
    expect(override.after.height).toBe(4.5);
  }
  expect(campuses.huyu.modelObstacles?.find(o => o.id === 'meihua-inferred-connector')?.polygon).toEqual(metadata.inferredConnector.fullWorldXZPolygon);
});
it('does not turn the north-gate study into a mapped or measured fact', async () => {
  const metadata = (await import('../../public/assets/campuses/huyu/north-gate.metadata.json', { with: { type: 'json' } })).default;
  const landmark = campuses.huyu.landmarks.find(l => l.id === 'hy-north-gate')!;
  expect(landmark.featureId).toBeNull();
  expect(landmark.optional).toBe(true);
  expect(landmark.positionStatus).toBe('approximate-inferred');
  expect(Object.values(metadata.facts).every(value => value === null)).toBe(true);
  expect(metadata.displayDesign.dimensionsStatus).toContain('not measured');
  expect(campuses.huyu.modelObstacles?.filter(o => o.id.startsWith('gate-design-'))).toHaveLength(2);
});
