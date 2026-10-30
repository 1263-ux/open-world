/** Input-only survival policy. The runtime snapshot is data, never a control API. */
export type Point = { x: number; y: number };
export type Structure = { currentHp: number; maxHp: number };
export type Structures = Record<'wood' | 'stone' | 'tile' | 'painting', Structure>;
export type SurvivalState = {
  scene: string;
  remaining: number;
  paused: boolean;
  ended: boolean;
  levelUp: boolean;
  kills: number;
  x: number;
  y: number;
  level: number;
  monsters: number;
  nearestXP: (Point & { value: number; distance: number }) | null;
  building: Point & { structures: Structures };
  boss: { spawned: boolean; killed: boolean; hp: number | null; maxHp: number | null; active: boolean; dead: boolean };
  outcome: 'victory' | 'defeat' | null;
  outcomeStructures: Structures | null;
  upgradeCards: Point[];
};
export type Movement = { kind: 'collect-xp' | 'orbit'; target: Point; keys: string[]; holdMs: number; plannedEnd: Point };
export const GAME_SECONDS = 420;
export const TRIAL_MS = 600_000;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function validateSurvivalState(value: unknown): asserts value is SurvivalState {
  const s = value as Partial<SurvivalState> | null;
  if (!s || typeof s.scene !== 'string' || !s.scene.split(',').includes('GameScene')) throw new Error('Expected active Hks GameScene');
  for (const field of ['remaining', 'kills', 'x', 'y', 'level', 'monsters'] as const) {
    if (!finite(s[field])) throw new Error(`Missing read-only Hks telemetry: ${field}`);
  }
  for (const field of ['paused', 'ended', 'levelUp'] as const) {
    if (typeof s[field] !== 'boolean') throw new Error(`Missing read-only Hks telemetry: ${field}`);
  }
  if (!s.building || !finite(s.building.x) || !finite(s.building.y)) throw new Error('Missing read-only Hks building telemetry');
  for (const type of ['wood', 'stone', 'tile', 'painting'] as const) {
    const hp = s.building.structures?.[type];
    if (!hp || !finite(hp.currentHp) || !finite(hp.maxHp) || hp.maxHp <= 0) throw new Error(`Missing Hks structure HP: ${type}`);
  }
  if (!s.boss || ['spawned', 'killed', 'active', 'dead'].some(k => typeof s.boss?.[k as keyof typeof s.boss] !== 'boolean')) {
    throw new Error('Missing read-only Hks Boss telemetry');
  }
  if ([s.boss.hp, s.boss.maxHp].some(n => n !== null && !finite(n)) || (s.boss.spawned && !(finite(s.boss.maxHp) && s.boss.maxHp > 0 && finite(s.boss.hp)))) {
    throw new Error('Missing read-only Hks Boss HP telemetry');
  }
  if (s.outcome !== null && s.outcome !== 'victory' && s.outcome !== 'defeat') throw new Error('Missing read-only Hks outcome telemetry');
  if (!('nearestXP' in s) || (s.nearestXP !== null && (!s.nearestXP || !finite(s.nearestXP.x) || !finite(s.nearestXP.y) || !finite(s.nearestXP.value) || !finite(s.nearestXP.distance)))) {
    throw new Error('Missing read-only Hks nearestXP telemetry');
  }
  if (!('outcomeStructures' in s) || (s.ended && !s.outcomeStructures)) throw new Error('Missing read-only Hks terminal-time HP telemetry');
  if (s.outcomeStructures) for (const type of ['wood', 'stone', 'tile', 'painting'] as const) {
    const hp = s.outcomeStructures[type];
    if (!hp || !finite(hp.currentHp) || !finite(hp.maxHp) || hp.maxHp <= 0) throw new Error(`Missing Hks terminal structure HP: ${type}`);
  }
  if (!Array.isArray(s.upgradeCards) || s.upgradeCards.some(p => !finite(p.x) || !finite(p.y))) throw new Error('Missing read-only Hks upgradeCards telemetry');
}

/** Liang-Barsky intersection against the native triangular base collider, conservatively bounded and inflated by player radius. */
export function crossesBase(from: Point, to: Point, base: Point): boolean {
  const minX = base.x - 174, maxX = base.x + 174;
  const minY = base.y - 144, maxY = base.y + 164;
  const dx = to.x - from.x, dy = to.y - from.y;
  let lo = 0, hi = 1;
  for (const [p, q] of [[-dx, from.x - minX], [dx, maxX - from.x], [-dy, from.y - minY], [dy, maxY - from.y]]) {
    if (p === 0) { if (q < 0) return false; }
    else if (p < 0) lo = Math.max(lo, q / p);
    else hi = Math.min(hi, q / p);
    if (lo > hi) return false;
  }
  return true;
}

export function chooseMovement(s: SurvivalState): Movement {
  const player = { x: s.x, y: s.y }, base = s.building;
  const xp = s.nearestXP;
  const reachableXP = xp && Math.hypot(xp.x - s.x, xp.y - s.y) <= 270
    && Math.hypot(xp.x - base.x, xp.y - base.y) <= 310 && !crossesBase(player, xp, base);
  const angle = Math.atan2(s.y - base.y, s.x - base.x) + 0.55;
  const target = reachableXP ? xp : { x: base.x + Math.cos(angle) * 240, y: base.y + Math.sin(angle) * 240 };
  const dx = target.x - s.x, dy = target.y - s.y, distance = Math.hypot(dx, dy);
  // Within the existing 120px attraction radius, wait briefly for actual collection.
  const settle = reachableXP && distance < 65;
  let keys: string[] = [];
  if (!settle) {
    if (dx < -12) keys.push('ArrowLeft'); else if (dx > 12) keys.push('ArrowRight');
    if (dy < -12) keys.push('ArrowUp'); else if (dy > 12) keys.push('ArrowDown');
  }
  const holdMs = settle ? 300 : Math.max(120, Math.min(400, distance / 240 * 700));
  const project = (input: string[]): Point => {
    const vx = Number(input.includes('ArrowRight')) - Number(input.includes('ArrowLeft'));
    const vy = Number(input.includes('ArrowDown')) - Number(input.includes('ArrowUp'));
    const scale = input.length ? 240 * holdMs / 1000 / Math.hypot(vx, vy) : 0;
    return { x: s.x + vx * scale, y: s.y + vy * scale };
  };
  // Arrow-key diagonals are 45 degrees, not the exact target vector. Check the
  // actual planned input segment as well, then choose a clear cardinal fallback.
  if (keys.length && crossesBase(player, project(keys), base)) {
    const candidates = [['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown']];
    candidates.sort((a, b) => Math.hypot(project(a).x - target.x, project(a).y - target.y) - Math.hypot(project(b).x - target.x, project(b).y - target.y));
    keys = candidates.find(input => !crossesBase(player, project(input), base)) ?? [];
    // The inflated AABB conservatively includes the real collider's rounded
    // corners. If already there, escape toward its nearest edge, never idle.
    if (!keys.length && s.x >= base.x - 174 && s.x <= base.x + 174 && s.y >= base.y - 144 && s.y <= base.y + 164) {
      const exits = [
        { key: 'ArrowLeft', depth: s.x - (base.x - 174) },
        { key: 'ArrowRight', depth: base.x + 174 - s.x },
        { key: 'ArrowUp', depth: s.y - (base.y - 144) },
        { key: 'ArrowDown', depth: base.y + 164 - s.y },
      ];
      exits.sort((a, b) => a.depth - b.depth);
      keys = [exits[0]!.key];
    }
  }
  return { kind: reachableXP ? 'collect-xp' : 'orbit', target: { x: target.x, y: target.y }, keys, holdMs, plannedEnd: project(keys) };
}

export function validateOutcome(s: SurvivalState): void {
  if (!s.ended || !s.outcome) throw new Error('No natural terminal outcome within the 600-second purpose window');
  if (!s.outcomeStructures) throw new Error('Natural outcome is missing terminal-time structure evidence');
  // Original update may heal a zero-HP structure later in the same terminal frame.
  const destroyed = Object.values(s.outcomeStructures).some(hp => hp.currentHp <= 0);
  if (s.outcome === 'victory' && (s.remaining > 0.001 || destroyed)) throw new Error('Victory telemetry contradicts the original timer/structure rule');
  if (s.outcome === 'defeat' && !destroyed) throw new Error('Defeat telemetry contradicts the original structure rule');
}
