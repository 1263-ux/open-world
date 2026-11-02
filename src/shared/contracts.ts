export type CampusMode = 'base' | 'ideal';
export interface CampusModeSwitchStatus { allowed: boolean; reason: string }
export interface CampusModeSwitchResult { applied: boolean; mode: CampusMode; reason: string }
export interface IdealActivityInspection { id: string; kind: 'reading' | 'photos'; label: string; available: boolean; reason: string; distance: number; direction: string }
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
  featureId: string | null; featureIds?: string[]; optional?: boolean; positionStatus?: 'approximate-inferred'; facts: string; source: string; visualSource?: string; clue: string;
  question: string; choices: string[]; answer: number;
}
export interface CampusData {
  id: CampusId; name: string; englishName: string; description: string;
  origin: Point2; boundary: Point2[]; bounds: [number,number,number,number];
  features: SpatialFeature[]; roads: CampusRoad[]; landmarks: Landmark[];
  questOrder: string[]; modelObstacles?: {id:string; polygon:Point2[]; status:'model-design-only'; source:string}[]; start: Point2; routes: Record<string, Point2[]>;
  extentMeters: [number, number]; attribution: string;
}
export interface PaperplaneInput { turn: number; pitch: number; }
export interface PaperplaneSnapshot { phase: 'ready'|'flying'|'result'; paused: boolean; elapsed: number; gatesPassed: number; gateCount: number; result: null|'success'|'collision'|'missed-gate'|'out-of-bounds'|'timeout'|'cancelled'; }
export type SceneEvent = {type:'paperplane';snapshot:PaperplaneSnapshot|null}| {type:'select';id:string}|{type:'arrive';id:string}|{type:'travel';progress:number}|{type:'error';reason:string}|{type:'modelstatus';id:string;name:string;status:'ready'|'fallback'};
export interface SceneState {selectedId:string|null;targetId:string|null;}
export interface PhotoPoint { heightRange?: [number, number]; position: Point2; target: [number, number, number]; frameExtent: [number, number, number][]; focusExtent: [number, number, number][]; radius: number; landmarkId?: string; }
export interface PhotoInspection { settling: boolean; inRange: boolean; framed: boolean; obstructed: boolean; distance: number; }
export interface CampusSceneHandle {
  inspectIdealActivity(): IdealActivityInspection | null;
  getCampusMode(): CampusMode;
  getModeSwitchStatus(): CampusModeSwitchStatus;
  requestCampusMode(mode: CampusMode): CampusModeSwitchResult;
  canBeginPaperplane(): boolean;
  beginPaperplane(): boolean;
  setPaperplaneInput(input: PaperplaneInput): void;
  launchPaperplane(): void;
  retryPaperplane(): void;
  pausePaperplane(): void;
  resumePaperplane(): void;
  endPaperplane(): void;
  inspectPhoto(point: PhotoPoint): PhotoInspection;
  capturePhoto(): string | null;
  setCampus(data:CampusData):void;
  setState(state:SceneState):void;
  navigateTo(id:string):boolean;
  resetJourney():void;
  focusLandmark(id:string):void;
  overview():void;
  resetView():void;
  pause():void;
  resume():void;
  dispose():void;
}
