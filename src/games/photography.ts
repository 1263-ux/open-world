/** Designed viewpoints, not surveyed entrances or navigation coordinates. */
export interface PhotoPoint {
  id: string;
  title: string;
  subtitle: string;
  instruction: string;
  subject: string;
  modelLabel: string;
  frameHint: string;
  designNote?: string;
  position: [number, number];
  target: [number, number, number];
  radius: number;
  landmarkId: string;
  frameExtent: [number, number, number][];
  focusExtent: [number, number, number][];
}
// Authored visual geometry, not surveyed building dimensions. The clock face is
// kept in the central frame and the tower facade must remain in the viewport.
const clockTarget: [number, number, number] = [-53.045, 12.52, 175.65];
const towerExtent: [number, number, number][] = [[-52.8, 9, 169.95], [-52.8, 9, 181.3], [-52.8, 14.95, 169.95], [-52.8, 14.95, 181.3]];
const clockExtent: [number, number, number][] = [[-53.045, 11.36, 174.49], [-53.045, 11.36, 176.81], [-53.045, 13.68, 174.49], [-53.045, 13.68, 176.81]];
// Original garden design: the central willow-like canopy is the subject; the
// planted island remains in frame. These are not surveyed coordinates.
const gardenTarget: [number, number, number] = [32.947655, 5.588023, 211.902723];
const gardenFocus: [number, number, number][] = [[31.705290, 5.078891, 211.766297], [33.823773, 5.038509, 211.762421], [32.839216, 6.143298, 211.899076], [33.253333, 3.709368, 211.793800]];
const gardenFrame: [number, number, number][] = [[27.494479, 5.318253, 210.764557], [42.295130, 4.878086, 210.131377], [32.839216, 6.143298, 211.899076], [35.85, .4, 204.18], [33.3, .4, 204.18], [38.4, .4, 204.18], [33.3, .4, 206.62], [38.4, .4, 206.62], [29.6, .65, 210.4], [40.4, .65, 210.4]];
export const PHOTO_POINTS: PhotoPoint[] = [
  { id: 'hall', title: '机械馆 · 初见', subtitle: '把钟楼收入画中', instruction: '在机械馆前的开阔处，转动视角寻找钟楼。', subject: '钟楼', modelLabel: '机械馆细节', frameHint: '调整视角：钟面放进框内，塔顶完整入画', position: [-20, 175.5], target: clockTarget, frameExtent: towerExtent, focusExtent: clockExtent, radius: 8, landmarkId: 'yx-mechanical' },
  { id: 'garden', title: '清泽园 · 花间', subtitle: '花岛与垂枝 · 游戏原创造景', instruction: '沿路向东再向南，到花园北侧，寻找花岛与垂枝。', subject: '垂枝树', modelLabel: '原创花园', frameHint: '调整视角：垂枝树放进框内，花岛完整入画', designNote: '游戏原创造景', position: [35, 193], target: gardenTarget, frameExtent: gardenFrame, focusExtent: gardenFocus, radius: 5.5, landmarkId: 'yx-garden-setting' },
];
const KEY = 'campus-atlas:photo-stamps:v1';
export function loadPhotoStamps(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? PHOTO_POINTS.map(point => point.id).filter(id => raw.includes(id)) : [];
  } catch { return []; }
}
export function savePhotoStamps(ids: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(PHOTO_POINTS.map(point => point.id).filter(id => ids.includes(id)))); } catch { /* memory-only is fine */ }
}
