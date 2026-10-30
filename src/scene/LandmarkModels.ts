import type { Group } from 'three';
import metadata from '../campus-data/mechanical-hall-model.json' with { type: 'json' };

export const mechanicalHall = {
  featureId: '182055474',
  landmarkId: 'yx-mechanical',
  centerX: metadata.centerX,
  centerZ: metadata.centerZ,
  url: `${import.meta.env.BASE_URL}assets/campuses/yingxi/mechanical-hall.glb`,
} as const;

export async function loadMechanicalHall(): Promise<Group> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(mechanicalHall.url);
  gltf.scene.position.set(mechanicalHall.centerX, 0, mechanicalHall.centerZ);
  gltf.scene.name = 'mechanical-hall-detail';
  return gltf.scene;
}
