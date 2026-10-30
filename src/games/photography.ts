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
}
export const PHOTO_POINTS: PhotoPoint[] = [
  { id: 'hall', title: '机械馆 · 初见', subtitle: '把钟楼收入画中', instruction: '在机械馆前的开阔处，转动视角寻找钟楼。', position: [-20, 175.5], target: [-73.04, 7.5, 173.14], radius: 8, landmarkId: 'yx-mechanical' },
  { id: 'garden', title: '清泽园 · 回望', subtitle: '沿林荫路走向园旁，再回望钟楼', instruction: '背对机械馆沿路向东走，距离数字变小即接近；在园旁回头取景。', position: [33.44, 172.76], target: [-73.04, 7.5, 173.14], radius: 9, landmarkId: 'yx-mechanical' },
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
