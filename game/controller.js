// Fixed-step movement independent of graphics throughput. Coordinates: Y up, -Z forward.
export class Controller {
  constructor({ x = 0, z = 7, walkable = () => true, colliders = [] } = {}) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = 0;
    this.speed = 0;
    this.accumulator = 0;
    this.walkable = walkable;
    this.colliders = colliders;
    this.blocked = false;
    this.boating = false;
    this.vx = 0;
    this.vz = 0;
  }
  blockedAt(x, z) {
    return (
      !this.walkable(x, z, this.boating) ||
      this.colliders.some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + 0.26 &&
          Math.abs(z - c.z) < c.d / 2 + 0.26,
      )
    );
  }
  step(dt, input = {}, yaw = 0) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.accumulator += Math.min(dt, 0.5);
    let n = 0;
    while (this.accumulator >= 1 / 60 && n++ < 30) {
      this.integrate(1 / 60, input, yaw);
      this.accumulator -= 1 / 60;
    }
    return this;
  }
  integrate(dt, input, yaw) {
    let ix = Number(input.right || 0) - Number(input.left || 0),
      iz = Number(input.backward || 0) - Number(input.forward || 0);
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const limit = this.boating ? 2.8 : input.run ? 4.2 : 2.65,
      tx = (ix * Math.cos(yaw) + iz * Math.sin(yaw)) * limit,
      tz = (-ix * Math.sin(yaw) + iz * Math.cos(yaw)) * limit;
    const response = this.boating ? 2.5 : 14,
      a = 1 - Math.exp(-response * dt);
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;
    const ox = this.x,
      oz = this.z;
    let nx = this.x + this.vx * dt,
      nz = this.z + this.vz * dt;
    this.blocked = false;
    if (!this.blockedAt(nx, this.z)) this.x = nx;
    else {
      this.vx = 0;
      this.blocked = true;
    }
    if (!this.blockedAt(this.x, nz)) this.z = nz;
    else {
      this.vz = 0;
      this.blocked = true;
    }
    this.speed = Math.hypot(this.x - ox, this.z - oz) / dt;
    if (this.speed > 0.05) {
      const target = Math.atan2(this.vx, this.vz),
        delta = Math.atan2(
          Math.sin(target - this.heading),
          Math.cos(target - this.heading),
        );
      this.heading += delta * (1 - Math.exp(-10 * dt));
    }
    if (input.jump && this.y <= 0 && !this.boating) this.vy = 3.4;
    this.vy -= 9 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
  }
  safeReset(x = 0, z = 7) {
    this.x = x;
    this.z = z;
    this.y = this.vx = this.vz = this.vy = this.accumulator = 0;
    this.boating = false;
  }
}
export function nearestInteraction(player, objects, radius = 2) {
  return (
    objects
      .filter((o) => o.enabled !== false)
      .map((o) => ({
        ...o,
        distance: Math.hypot(player.x - o.x, player.z - o.z),
      }))
      .filter((o) => o.distance <= (o.radius ?? radius))
      .sort((a, b) => a.distance - b.distance)[0] ?? null
  );
}
