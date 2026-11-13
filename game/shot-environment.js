// Memory shots belong to their photographed place, not the player's saved return position.
export function environmentAnchor(stage, player, focus) {
  const p = stage === "memory" ? focus : player;
  return { x: p.x, y: p.y || 0, z: p.z };
}
