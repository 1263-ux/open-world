/** Normal melee needs both distance and cooldown; the Boss earthquake stays global. */
export function canMeleeAttack(distance: number, range: number, elapsed: number, interval: number): boolean {
  return distance <= range && elapsed >= interval;
}
