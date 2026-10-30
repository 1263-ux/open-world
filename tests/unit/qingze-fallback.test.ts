import { expect, it } from 'vitest';
import { Box3, Mesh } from 'three';
import { createQingzeFallback } from '../../src/scene/QingzeGarden';
import { disposeObject } from '../../src/scene/CampusScene';

it('pairs every designed fallback collider with matching visible fallback geometry', () => {
  const { visual, colliders } = createQingzeFallback();
  visual.updateMatrixWorld(true); colliders.updateMatrixWorld(true);
  const solids = visual.children.filter((item): item is Mesh => item instanceof Mesh && item.visible);
  const boxes = solids.map(item => new Box3().setFromObject(item));
  expect(colliders.children.length).toBeGreaterThan(0);
  for (const proxy of colliders.children) {
    const bounds = new Box3().setFromObject(proxy);
    expect(bounds.isEmpty()).toBe(false);
    const hasVisibleCounterpart = boxes.some(box => box.min.distanceTo(bounds.min) < .0001 && box.max.distanceTo(bounds.max) < .0001);
    expect(hasVisibleCounterpart, `fallback collider ${proxy.name || proxy.id} must have a visible matching object`).toBe(true);
  }
  disposeObject(visual); disposeObject(colliders);
});
