// Animation time is derived from the story clock so pause, seeking and reload agree.
export function memoryClipTime(memoryTime, cueStart, duration, hold = 1) {
  if (
    ![memoryTime, cueStart, duration, hold].every(Number.isFinite) ||
    duration < 0
  )
    return 0;
  return Math.max(0, Math.min(duration, memoryTime - cueStart - hold));
}

export function shouldCutShot(previous, next) {
  return previous !== next && !!(previous || next);
}
