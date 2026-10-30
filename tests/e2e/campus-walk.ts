/** Input-only route steering. Campus geometry and the canvas position are read-only;
 * the player is always moved by actual held keys, never by writing game state. */
import type { Page, Locator } from '@playwright/test';
import type { CampusData, Point2 } from '../../src/shared/contracts';

type P = [number, number];
const cell = 2;
const margin = 0.8;
function pointInPolygon(p: P, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function segmentDistance(p: P, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function obstacles(campus: CampusData) {
  return [...campus.features.filter(f => f.kind === 'building'), ...(campus.modelObstacles ?? [])].filter(f => f.polygon.length >= 3).map(f => ({
    polygon: f.polygon,
    minX: Math.min(...f.polygon.map(p => p[0])) - margin, maxX: Math.max(...f.polygon.map(p => p[0])) + margin,
    minZ: Math.min(...f.polygon.map(p => p[1])) - margin, maxZ: Math.max(...f.polygon.map(p => p[1])) + margin,
  }));
}
/** A* on source building footprints with clearance. This is a test-side input policy,
 * not a navigation capability claim or a substitute for checking visible directions. */
export function walkRoute(campus: CampusData, from: P, to: P): P[] {
  const buildings = obstacles(campus);
  const x0 = Math.floor((Math.min(from[0], to[0]) - 300) / cell) * cell;
  const z0 = Math.floor((Math.min(from[1], to[1]) - 300) / cell) * cell;
  const cols = Math.ceil((Math.max(from[0], to[0]) + 300 - x0) / cell) + 1;
  const rows = Math.ceil((Math.max(from[1], to[1]) + 300 - z0) / cell) + 1;
  const toIndex = (p: P) => Math.max(0, Math.min(cols - 1, Math.round((p[0] - x0) / cell))) + cols * Math.max(0, Math.min(rows - 1, Math.round((p[1] - z0) / cell)));
  const at = (id: number): P => [x0 + (id % cols) * cell, z0 + Math.floor(id / cols) * cell];
  const blocked = (p: P) => buildings.some(b => p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ &&
    (pointInPolygon(p, b.polygon) || b.polygon.some((v, i) => segmentDistance(p, v, b.polygon[(i + 1) % b.polygon.length]!) < margin)));
  const start = toIndex(from), goal = toIndex(to);
  if (blocked(at(start)) || blocked(at(goal))) throw new Error(`Route endpoint obstructed near ${from} -> ${to}`);
  const score = new Map<number, number>([[start, 0]]), parent = new Map<number, number>();
  const open: Array<{ id: number; f: number }> = [{ id: start, f: 0 }];
  const push = (entry: { id: number; f: number }) => { open.push(entry); let i = open.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (open[p]!.f <= entry.f) break; open[i] = open[p]!; i = p; } open[i] = entry; };
  const pop = () => { const result = open[0]!, last = open.pop()!; if (open.length) { let i = 0; while (2 * i + 1 < open.length) { let c = 2 * i + 1; if (c + 1 < open.length && open[c + 1]!.f < open[c]!.f) c++; if (open[c]!.f >= last.f) break; open[i] = open[c]!; i = c; } open[i] = last; } return result; };
  const closed = new Set<number>();
  while (open.length) {
    const id = pop().id; if (closed.has(id)) continue; closed.add(id);
    if (id === goal) { const route: P[] = [to]; let n = id; while (n !== start) { route.push(at(n)); n = parent.get(n)!; } return route.reverse(); }
    const col = id % cols, row = Math.floor(id / cols);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x = col + dx!, z = row + dz!; if (x < 0 || x >= cols || z < 0 || z >= rows) continue;
      const next = x + z * cols;
      if (blocked(at(next)) || (dx && dz && (blocked(at(col + dx! + row * cols)) || blocked(at(col + (row + dz!) * cols))))) continue;
      const g = score.get(id)! + Math.hypot(dx!, dz!);
      if (g >= (score.get(next) ?? Infinity)) continue;
      score.set(next, g); parent.set(next, id);
      const p = at(next); push({ id: next, f: g + Math.hypot(p[0] - to[0], p[1] - to[1]) / cell });
    }
  }
  throw new Error(`No collision-aware walking route ${from} -> ${to}`);
}
export async function position(canvas: Locator): Promise<[number, number, number]> {
  const xyz = await Promise.all(['x', 'y', 'z'].map(k => canvas.getAttribute(`data-player-${k}`)));
  if (xyz.some(v => v === null || !Number.isFinite(Number(v)))) throw new Error(`Missing read-only player XYZ: ${xyz}`);
  return xyz.map(Number) as [number, number, number];
}
export function waypointKeys(dx: number, dz: number, yaw: number): string[] {
  // Invert the camera-relative movement transform used by PlayerController.
  const x = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const y = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const keys: string[] = [];
  if (Math.abs(x) > .6) keys.push(x > 0 ? 'KeyD' : 'KeyA');
  if (Math.abs(y) > .6) keys.push(y > 0 ? 'KeyW' : 'KeyS');
  return keys;
}
export async function walkTo(page: Page, canvas: Locator, campus: CampusData, target: Point2) {
  const [x,,z] = await position(canvas), route = walkRoute(campus, [x,z], [target[0], target[1]]);
  let last = [x,z], stagnant = 0;
  for (const waypoint of route) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const [px,,pz] = await position(canvas), dx = waypoint[0] - px, dz = waypoint[1] - pz;
      if (Math.hypot(dx,dz) < .9 || Math.hypot(target[0] - px, target[1] - pz) < 4.5) break;
      // The axis threshold is below .9 / sqrt(2), so every point outside
      // the waypoint tolerance has at least one direction to steer.
      const yaw = Number(await canvas.getAttribute('data-camera-yaw'));
      if (!Number.isFinite(yaw)) throw new Error('Missing read-only camera yaw');
      const keys = waypointKeys(dx, dz, yaw);
      await page.keyboard.down('Shift'); for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(Math.max(80, Math.min(300, Math.hypot(dx,dz) / 6.5 * 500)));
      for (const key of keys) await page.keyboard.up(key); await page.keyboard.up('Shift');
      const [nx,,nz] = await position(canvas);
      if (Math.hypot(nx-last[0]!,nz-last[1]!) < .05) stagnant++; else stagnant = 0;
      if (stagnant >= 12) throw new Error(`Player stuck at ${nx},${nz}; waypoint ${waypoint}`);
      last = [nx,nz];
      if (attempt === 29) throw new Error(`Failed to reach waypoint ${waypoint}, player at ${nx},${nz}`);
    }
  }
}
