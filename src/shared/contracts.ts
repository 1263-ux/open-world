export type CampusId = 'huyu' | 'yingxi';
export type Point2 = [number, number];
export interface SpatialFeature {
  id: string; name: string; kind: 'building'|'park'|'sports'; polygon: Point2[];
  height: number; heightStatus: 'osm-tag'|'level-estimate'|'ml-estimate'|'unverified';
  sourceId?: string;
  heightSource?: {dataset: string; year?: number; method: string; matchIoU?: number; sourceId?: string; source?: string};
  levels: number | null; source: string;
}
export interface CampusRoad { id: string; points: Point2[]; width: number; source: string; }
export interface Landmark {
  id: string; name: string; subtitle: string; position: Point2; arrival: Point2;
  featureId: string | null; facts: string; source: string; clue: string;
  question: string; choices: string[]; answer: number;
}
export interface CampusData {
  id: CampusId; name: string; englishName: string; description: string;
  origin: Point2; boundary: Point2[]; bounds: [number,number,number,number];
  features: SpatialFeature[]; roads: CampusRoad[]; landmarks: Landmark[];
  questOrder: string[]; start: Point2; routes: Record<string, Point2[]>;
  extentMeters: [number, number]; attribution: string;
}
export type SceneEvent = {type:'select';id:string}|{type:'arrive';id:string}|{type:'travel';progress:number}|{type:'error';reason:string};
export interface SceneState {selectedId:string|null;targetId:string|null;}
export interface CampusSceneHandle {
  setCampus(data:CampusData):void;
  setState(state:SceneState):void;
  navigateTo(id:string):boolean;
  resetJourney():void;
  focusLandmark(id:string):void;
  overview():void;
  resetView():void;
  dispose():void;
}
