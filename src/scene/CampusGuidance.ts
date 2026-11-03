import type { CampusData, Point2 } from '../shared/contracts';

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
/** Existing building-footprint A* from campus-walk, bounded and constrained to the campus.
 * Only the free-position connector uses this; authored route segments are not replanned. */
function connectorRoute(campus: CampusData, from: P, to: P): { points: P[]; expandedNodes: number } | null {
  const buildings = obstacles(campus);
  const x0 = Math.floor((Math.max(Math.min(from[0], to[0]) - 300, Math.min(...campus.boundary.map(p => p[0])))) / cell) * cell;
  const z0 = Math.floor((Math.max(Math.min(from[1], to[1]) - 300, Math.min(...campus.boundary.map(p => p[1])))) / cell) * cell;
  const cols = Math.ceil((Math.min(Math.max(from[0], to[0]) + 300, Math.max(...campus.boundary.map(p => p[0]))) - x0) / cell) + 1;
  const rows = Math.ceil((Math.min(Math.max(from[1], to[1]) + 300, Math.max(...campus.boundary.map(p => p[1]))) - z0) / cell) + 1;
  if (cols <= 0 || rows <= 0 || !Number.isSafeInteger(cols * rows) || cols * rows > 120000) return null;
  const toIndex = (p: P) => Math.max(0, Math.min(cols - 1, Math.round((p[0] - x0) / cell))) + cols * Math.max(0, Math.min(rows - 1, Math.round((p[1] - z0) / cell)));
  const at = (id: number): P => [x0 + (id % cols) * cell, z0 + Math.floor(id / cols) * cell];
  const blockedCache = new Map<number, boolean>();
  const blocked = (p: P): boolean => {
    const index = toIndex(p), cached = blockedCache.get(index);
    if (cached !== undefined) return cached;
    const value = !pointInPolygon(p, campus.boundary) || campus.boundary.some((a,i) => segmentDistance(p,a,campus.boundary[(i+1)%campus.boundary.length]!) < margin) || buildings.some(b => p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ &&
    (pointInPolygon(p, b.polygon) || b.polygon.some((v, i) => segmentDistance(p, v, b.polygon[(i + 1) % b.polygon.length]!) < margin)));
    blockedCache.set(index, value); return value;
  };
  const start = toIndex(from), goal = toIndex(to);
  if (blocked(at(start)) || blocked(at(goal))) return null;
  const score = new Map<number, number>([[start, 0]]), parent = new Map<number, number>();
  const open: Array<{ id: number; f: number }> = [{ id: start, f: 0 }];
  const push = (entry: { id: number; f: number }) => { open.push(entry); let i = open.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (open[p]!.f <= entry.f) break; open[i] = open[p]!; i = p; } open[i] = entry; };
  const pop = () => { const result = open[0]!, last = open.pop()!; if (open.length) { let i = 0; while (2 * i + 1 < open.length) { let c = 2 * i + 1; if (c + 1 < open.length && open[c + 1]!.f < open[c]!.f) c++; if (open[c]!.f >= last.f) break; open[i] = open[c]!; i = c; } open[i] = last; } return result; };
  const closed = new Set<number>();
  while (open.length) {
    const id = pop().id; if (closed.has(id)) continue; closed.add(id);
    if (closed.size > 20000) return null;
    if (id === goal) { const route: P[] = [to]; let n = id; while (n !== start) { route.push(at(n)); n = parent.get(n)!; } return { points: route.reverse(), expandedNodes: closed.size }; }
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
  return null;
}

/** Continuous segment/edge clearance, including the actual off-grid endpoints. */
function segmentSeparation(a: Point2, b: Point2, c: Point2, d: Point2): number {
  const cross = (p:Point2,q:Point2,r:Point2) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if (abC*abD<0 && cdA*cdB<0) return 0;
  return Math.min(segmentDistance([...a],c,d),segmentDistance([...b],c,d),segmentDistance([...c],a,b),segmentDistance([...d],a,b));
}
function connectorIsClear(campus: CampusData, points: Point2[]): boolean {
  const walls = obstacles(campus);
  return points.every((b,index) => {
    const a=points[Math.max(0,index-1)]!;
    if (!pointInPolygon([...a],campus.boundary)||!pointInPolygon([...b],campus.boundary)) return false;
    if (campus.boundary.some((p,i)=>segmentSeparation(a,b,p,campus.boundary[(i+1)%campus.boundary.length]!)<margin)) return false;
    return !walls.some(w => {
      if(Math.max(a[0],b[0])<w.minX||Math.min(a[0],b[0])>w.maxX||Math.max(a[1],b[1])<w.minZ||Math.min(a[1],b[1])>w.maxZ) return false;
      return pointInPolygon([...a],w.polygon)||pointInPolygon([...b],w.polygon)||w.polygon.some((p,i)=>segmentSeparation(a,b,p,w.polygon[(i+1)%w.polygon.length]!)<margin);
    });
  });
}
export interface CampusGuidancePlan { points: Point2[]; connectorCount: number; expandedNodes: number }
/** Static-building-safe guidance, not automatic walking or dynamic obstacle avoidance.
 * No cross-call cache; at most 120k grid cells / 20k expanded search nodes. */
export function planCampusGuidance(campus: CampusData, start: Point2, id: string): CampusGuidancePlan | null {
  const valid=(p:Point2)=>Number.isFinite(p[0])&&Number.isFinite(p[1]);
  const landmark=campus.landmarks.find(item=>item.id===id);
  if(!landmark||!valid(start)||!valid(landmark.arrival)||campus.boundary.length<3) return null;
  let closest=Infinity, suffix:Point2[]=[landmark.arrival];
  for(const [key,points] of Object.entries(campus.routes)) {
    if(!key.endsWith(`>${id}`)) continue;
    for(let i=0;i<points.length;i++) {
      if(!valid(points[i]!)||!points.slice(i).every(valid)) continue;
      const separation=Math.hypot(start[0]-points[i]![0],start[1]-points[i]![1]);
      if(separation<closest){closest=separation;suffix=points.slice(i);}
    }
  }
  if (!connectorIsClear(campus,[start]) || !connectorIsClear(campus,[suffix[0]!])) return null;
  const connector=connectorRoute(campus,[...start],[...suffix[0]!]);
  if(!connector||!connectorIsClear(campus,[start,...connector.points])) return null;
  return {points:[...connector.points,...suffix.slice(1)],connectorCount:connector.points.length,expandedNodes:connector.expandedNodes};
}
