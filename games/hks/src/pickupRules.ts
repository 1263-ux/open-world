/** Advance an attracted orb without crossing its target between frames. */
export function resolveAttractionStep(
  distance: number, speed: number, deltaSeconds: number, collectDistance: number,
): { step: number; collected: boolean } {
  const step = Math.min(distance, Math.max(0, speed * deltaSeconds));
  // Check the swept movement, not only its starting point. This gives the
  // same pickup radius at low frame rates without increasing speed or XP.
  return { step, collected: distance - step <= collectDistance };
}
