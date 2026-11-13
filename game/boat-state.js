export function boatPose(stage, player, time = 0) {
  if (stage === "memory") return { x: 0, y: 0.06, z: -61, heading: Math.PI };
  return {
    x: player.boating ? player.x : 0,
    y: 0.06 + Math.sin(time) * 0.015,
    z: player.boating ? player.z : -28,
    heading: player.boating ? player.heading : 0,
  };
}
