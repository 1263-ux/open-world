export function safeAnchor(stage) {
  return ["sailing", "sunset"].includes(stage)
    ? { x: 0, z: -28, boating: true }
    : stage === "returning"
      ? { x: 0, z: -27, boating: false }
      : { x: 0.5, z: 6.7, boating: false };
}
export function restorePlayer(saved, story, world) {
  const fallback = safeAnchor(story.stage),
    p = saved?.player;
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    typeof p.boating !== "boolean" ||
    !world.walkable(p.x, p.z, p.boating)
  )
    return fallback;
  // A rejected story save must never retain a valid-looking but unrelated physical location.
  if (saved.story?.stage !== story.stage) return fallback;
  if (["sailing", "sunset"].includes(story.stage) && !p.boating)
    return fallback;
  if (
    ["letter", "folds", "ready", "echo", "memory", "complete"].includes(
      story.stage,
    ) &&
    p.boating
  )
    return fallback;
  if (
    world.colliders.some(
      (c) =>
        Math.abs(p.x - c.x) < c.w / 2 + 0.26 &&
        Math.abs(p.z - c.z) < c.d / 2 + 0.26,
    )
  )
    return fallback;
  return { x: p.x, z: p.z, boating: p.boating };
}
