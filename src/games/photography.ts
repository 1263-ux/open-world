/** Designed viewpoints, not surveyed entrances or navigation coordinates. */
export interface PhotoPoint {
  id: string;
  title: string;
  subtitle: string;
  instruction: string;
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
export const PHOTO_POINTS: PhotoPoint[] = [
  { id: 'hall', title: '机械馆 · 初见', subtitle: '把钟楼收入画中', instruction: '在机械馆前的开阔处，转动视角寻找钟楼。', position: [-20, 175.5], target: clockTarget, frameExtent: towerExtent, focusExtent: clockExtent, radius: 8, landmarkId: 'yx-mechanical' },
  { id: 'garden', title: '清泽园 · 回望', subtitle: '沿林荫路走向园旁，再回望钟楼', instruction: '背对机械馆沿路向东走，在园旁回头对准钟楼。', position: [33.44, 172.76], target: clockTarget, frameExtent: towerExtent, focusExtent: clockExtent, radius: 9, landmarkId: 'yx-mechanical' },
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
