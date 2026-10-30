import { expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial } from 'three';
import { disposeObject } from '../../src/scene/CampusScene';

it('disposes instance buffers and shared geometry/material exactly once', () => {
  const scene = new Group(), world = new Group();
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  let instances = 0, geometries = 0, materials = 0;
  geometry.addEventListener('dispose', () => geometries++);
  material.addEventListener('dispose', () => materials++);
  for (let i = 0; i < 2; i++) {
    const mesh = new InstancedMesh(geometry, material, 3);
    mesh.addEventListener('dispose', () => instances++);
    world.add(mesh);
  }
  scene.add(world);
  disposeObject(world);
  expect(instances).toBe(2);
  expect(geometries).toBe(1);
  expect(materials).toBe(1);
  expect(scene.children).toHaveLength(0);
});
