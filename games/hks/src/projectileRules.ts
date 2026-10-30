/** Test a projectile's frame segment against the original circular hit radius. */
export function segmentIntersectsCircle(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, radius: number,
): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : ((cx - x0) * dx + (cy - y0) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const nearestX = x0 + dx * t, nearestY = y0 + dy * t;
  return (nearestX - cx) ** 2 + (nearestY - cy) ** 2 < radius ** 2;
}
