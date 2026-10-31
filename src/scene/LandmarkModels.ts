import type { Group } from 'three';
import type { CampusId } from '../shared/contracts';
import { styleLandmarkMaterials } from './LandmarkStyle';
import mechanical from '../campus-data/mechanical-hall-model.json' with { type: 'json' };
import huyu from '../campus-data/huyu-models.json' with { type: 'json' };

export interface LandmarkModel {
  landmarkId: string; name: string; campusId: CampusId; featureIds: string[]; selectionId?: string;
  centerX: number; centerZ: number; url: string; markerHeight: number;
}
const base = `${import.meta.env.BASE_URL}assets/campuses/`;
export const landmarkModels: LandmarkModel[] = [
  { landmarkId: 'yx-mechanical', name: '机械馆', campusId: 'yingxi', featureIds: ['182055474'], ...mechanical, url: `${base}yingxi/mechanical-hall.glb`, markerHeight: 19 },
  { landmarkId: 'yx-garden-setting', selectionId: 'yx-garden', name: '清泽园场景化园景', campusId: 'yingxi', featureIds: [], centerX: 35, centerZ: 205, url: `${base}yingxi/qingze-reading-garden.glb`, markerHeight: 4 },
  { landmarkId: 'hy-meihua', name: '梅花教室组合', campusId: 'huyu', ...huyu.meihua, url: `${base}huyu/meihua-classroom-group.glb`, markerHeight: 8.5 },
  { landmarkId: 'hy-north-gate', name: '北门（示意）', campusId: 'huyu', featureIds: [], ...huyu.gate, url: `${base}huyu/north-gate.glb`, markerHeight: 13 },
];
export async function loadLandmarkModel(config: LandmarkModel): Promise<Group> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(config.url);
  styleLandmarkMaterials(gltf.scene, config.landmarkId);
  gltf.scene.position.set(config.centerX, 0, config.centerZ);
  gltf.scene.name = `${config.landmarkId}-detail`;
  return gltf.scene;
}
