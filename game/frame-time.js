// Physics stays bounded; visible narrative time must not slow down on a low-FPS device.
export function frameTime(now, last) {
  const wall = Math.max(0, Math.min(60, (now - last) / 1000));
  return { wall, physics: Math.min(0.5, wall) };
}
