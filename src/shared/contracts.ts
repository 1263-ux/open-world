export type CampusId = 'huyu' | 'yingxi';
export type ShapeKind = 'gate' | 'library' | 'teaching' | 'office' | 'garden';
export interface Landmark {
  id: string; name: string; subtitle: string; position: [number, number];
  size: [number, number, number]; shape: ShapeKind; color: string;
  facts: string; source: string; status: 'schematic';
}
export interface CampusData {
  id: CampusId; name: string; englishName: string; description: string;
  landmarks: Landmark[]; questOrder: string[];
}
export type SceneEvent = {type: 'select'; id: string} | {type: 'error'; reason: string};
export interface SceneState {selectedId: string | null; targetId: string | null;}
export interface CampusSceneHandle {
  setCampus(data: CampusData): void;
  setState(state: SceneState): void;
  resetView(): void;
  dispose(): void;
}
