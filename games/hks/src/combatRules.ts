/** Boss normal melee must be both in range and off cooldown; its earthquake remains global. */
export function canMeleeAttack(distance: number, range: number, elapsedMs: number, cooldownMs: number): boolean {
  return distance <= range && elapsedMs >= cooldownMs;
}
