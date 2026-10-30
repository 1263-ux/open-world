import { describe, expect, it } from 'vitest';
import { canMeleeAttack } from '../../games/hks/src/combatRules';
import { BUILDING_CONFIG, GAME_DURATION, GAME_HEIGHT, GAME_WIDTH } from '../../games/hks/src/config';

describe('shipped Hks constants and Boss normal melee guard', () => {
  it('retains the native landscape canvas and seven-minute game', () => {
    expect([GAME_WIDTH, GAME_HEIGHT, GAME_DURATION]).toEqual([1280, 720, 420]);
  });
  it('requires both range and cooldown at their boundaries', () => {
    // Boss.ts uses the configured building attack radius plus its 60px allowance.
    const range = BUILDING_CONFIG.attackRange + 60;
    expect(canMeleeAttack(range + .01, range, 9000, 1500)).toBe(false);
    expect(canMeleeAttack(range, range, 1499, 1500)).toBe(false);
    expect(canMeleeAttack(range, range, 1500, 1500)).toBe(true);
    expect(canMeleeAttack(700, range, 9000, 1500)).toBe(false);
  });
});
