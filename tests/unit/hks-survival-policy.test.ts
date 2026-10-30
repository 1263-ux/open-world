import { describe, expect, it } from 'vitest';
import { chooseMovement, crossesBase, validateOutcome, validateSurvivalState, type SurvivalState } from '../e2e/hks-survival-policy';
const state = (): SurvivalState => ({
  scene: 'GameScene', remaining: 300, paused: false, ended: false, levelUp: false,
  kills: 0, x: 960, y: 710, level: 1, monsters: 0, nearestXP: null,
  building: { x: 960, y: 540, structures: { wood: { currentHp: 120, maxHp: 120 }, stone: { currentHp: 70, maxHp: 70 }, tile: { currentHp: 90, maxHp: 90 }, painting: { currentHp: 80, maxHp: 80 } } },
  boss: { spawned: false, killed: false, hp: null, maxHp: null, active: false, dead: false },
  outcome: null, outcomeStructures: null, upgradeCards: [],
});
describe('Hks natural-play policy and truthful terminal guards', () => {
  it('accepts complete read-only telemetry and rejects old snapshots before playing', () => {
    expect(() => validateSurvivalState(state())).not.toThrow();
    expect(() => validateSurvivalState({ scene: 'GameScene' })).toThrow('telemetry');
    expect(() => validateSurvivalState({ ...state(), outcome: undefined })).toThrow('outcome');
  });
  it('moves toward nearby XP and settles inside actual attraction range', () => {
    const s = state(); s.nearestXP = { x: 1060, y: 710, value: 6, distance: 100 };
    expect(chooseMovement(s)).toMatchObject({ kind: 'collect-xp', keys: ['ArrowRight'] });
    s.nearestXP.x = 1000;
    expect(chooseMovement(s)).toMatchObject({ kind: 'collect-xp', keys: [] });
  });
  it('does not abandon the base for distant XP or walk through the solid plinth', () => {
    const s = state(); s.nearestXP = { x: 1600, y: 710, value: 6, distance: 640 };
    expect(chooseMovement(s).kind).toBe('orbit');
    s.nearestXP = { x: 960, y: 500, value: 6, distance: 210 };
    expect(crossesBase(s, s.nearestXP, s.building)).toBe(true);
    expect(chooseMovement(s).kind).toBe('orbit');
  });
  it('keeps orbit targets close to the building with a collision-free path', () => {
    for (let i = 0; i < 36; i++) {
      const s = state(); s.x = 960 + Math.cos(i / 36 * Math.PI * 2) * 170; s.y = 540 + Math.sin(i / 36 * Math.PI * 2) * 170;
      const m = chooseMovement(s);
      expect(Math.hypot(m.target.x - 960, m.target.y - 540)).toBeCloseTo(170);
      expect(crossesBase(s, m.target, s.building)).toBe(false);
      expect(crossesBase(s, m.plannedEnd, s.building)).toBe(false);
      expect(m.keys.every(key => /^Arrow(Left|Right|Up|Down)$/.test(key))).toBe(true);
    }
  });
  it('checks the real equal-axis key trajectory, not only the target vector', () => {
    const s = state(); s.x = 870; s.y = 500;
    s.nearestXP = { x: 890, y: 570, value: 6, distance: Math.hypot(20, 70) };
    expect(crossesBase(s, s.nearestXP, s.building)).toBe(false);
    const m = chooseMovement(s);
    expect(crossesBase(s, m.plannedEnd, s.building)).toBe(false);
    expect(m.keys).not.toEqual(['ArrowRight', 'ArrowDown']);
  });
  it('escapes a conservative corner bound rather than remaining input-idle', () => {
    const s = state(); s.x = 900; s.y = 538;
    const m = chooseMovement(s);
    expect(m.keys).toEqual(['ArrowLeft']);
    expect(m.plannedEnd.x).toBeLessThan(s.building.x - 64);
    expect(Math.hypot(m.plannedEnd.x - s.building.x, m.plannedEnd.y - s.building.y)).toBeGreaterThan(Math.hypot(s.x - s.building.x, s.y - s.building.y));
  });
  it('accepts natural loss, accepts timer victory, and rejects synthetic/inconsistent outcomes', () => {
    const loss = state(); loss.ended = true; loss.outcome = 'defeat'; loss.remaining = 200; loss.outcomeStructures = structuredClone(loss.building.structures); loss.outcomeStructures.wood.currentHp = 0;
    // Genuine endGame(false), followed by same-frame crate healing, must pass.
    expect(loss.building.structures.wood.currentHp).toBeGreaterThan(0);
    expect(() => validateOutcome(loss)).not.toThrow();
    const win = state(); win.ended = true; win.outcome = 'victory'; win.remaining = 0; win.outcomeStructures = structuredClone(win.building.structures);
    expect(() => validateOutcome(win)).not.toThrow();
    expect(() => validateOutcome({ ...win, remaining: 200 })).toThrow('contradicts');
    expect(() => validateOutcome(state())).toThrow('420-second');
    expect(() => validateOutcome({ ...win, outcome: 'defeat' })).toThrow('contradicts');
  });
});
