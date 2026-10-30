import { expect, it } from 'vitest';
import { canMeleeAttack } from '../../games/hks/src/combatRules';

it('does not let Boss normal melee damage a building from across the map', () => {
  expect(canMeleeAttack(700, 140, 9000, 1500)).toBe(false);
  expect(canMeleeAttack(100, 140, 1000, 1500)).toBe(false);
  expect(canMeleeAttack(140, 140, 1500, 1500)).toBe(true);
});
