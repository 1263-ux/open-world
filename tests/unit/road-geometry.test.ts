import { expect, it } from 'vitest';
import { strips } from '../../src/scene/CampusScene';

it('roads and curbs face upward for every segment direction', () => {
  for (const extra of [0, 1.15]) {
    const geometry = strips([{ id: 'test', points: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], width: 4, source: '' }], extra);
    const normals = geometry.getAttribute('normal');
    expect(normals.count).toBe(24);
    for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeCloseTo(1);
    geometry.dispose();
  }
});
