import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { campusFacadeFamily } from '../../src/scene/CampusScene';
import { composeCampusFacadeEdge } from '../../src/scene/CampusFacadeComposition';

describe('explicit route-visible facade integration', () => {
  it('selects only two source buildings and route-facing normals', () => {
    expect(campusFacadeFamily('689323083', -1, 0)).toBe('plinth-top');
    expect(campusFacadeFamily('689323083', 0, -1)).toBe('plinth-top');
    expect(campusFacadeFamily('689323083', 1, 0)).toBeNull();
    expect(campusFacadeFamily('195741288', -1, 0)).toBe('horizontal-ribbon');
    expect(campusFacadeFamily('195741288', 1, 0)).toBeNull();
    for (const id of ['182055474', 'hy-meihua', 'overture:b39690f0-0259-420f-8c33-e8f982bc8273', 'overture:3e1ccab7-45a2-4e02-9968-86a57837641c']) {
      expect(campusFacadeFamily(id, -1, -1)).toBeNull();
    }
  });
  it('keeps actual selected geometry bounded and replaces rather than doubles pane counts', () => {
    const source = JSON.stringify(campuses);
    const records: Record<string, { edges: number; panes: number; oldPanes: number; strips: number }> = {};
    for (const campus of Object.values(campuses)) for (const feature of campus.features) {
      if (feature.kind !== 'building') continue;
      const polygon = feature.polygon.filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
      if (polygon.length > 1 && polygon[0][0] === polygon.at(-1)![0] && polygon[0][1] === polygon.at(-1)![1]) polygon.pop();
      const area = polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
      const height = feature.height;
      const floors = Math.min(30, Math.max(1, feature.levels && feature.levels > 0 ? Math.round(feature.levels) : Math.floor(height / 3.4)));
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        if (!length) continue;
        const sign = area >= 0 ? 1 : -1;
        const family = campusFacadeFamily(feature.id, sign * dz / length, -sign * dx / length);
        if (!family) continue;
        const layout = composeCampusFacadeEdge({ family, length, height, floors });
        if (!layout) continue;
        const row = records[campus.id] ?? { edges: 0, panes: 0, oldPanes: 0, strips: 0 };
        row.edges++; row.panes += layout.windows.length; row.oldPanes += Math.min(100, Math.floor(length / 4.5)) * floors; row.strips += layout.strips.length;
        records[campus.id] = row;
      }
    }
    expect(Object.keys(records).sort()).toEqual(['huyu', 'yingxi']);
    for (const row of Object.values(records)) {
      expect(row.edges).toBeGreaterThan(0);
      expect(row.panes).toBeLessThanOrEqual(row.oldPanes);
      expect(row.strips).toBeLessThan(60);
      expect(row.panes).toBeLessThan(250);
    }
    expect(JSON.stringify(campuses)).toBe(source);
    console.info('FACADE_COMPOSITION_BUDGET', JSON.stringify(records));
  });
});
