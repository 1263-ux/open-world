import test from "node:test";
import assert from "node:assert/strict";
import { Controller, nearestInteraction } from "./controller.js";
test("wall-clock distance stable at 15 and 60 fps", () => {
  const a = new Controller(),
    b = new Controller();
  for (let i = 0; i < 600; i++) a.step(1 / 60, { forward: true });
  for (let i = 0; i < 150; i++) b.step(1 / 15, { forward: true });
  assert.ok(Math.abs(a.z - b.z) < 0.05);
  assert.ok(a.z < -18);
});
test("diagonal speed bounded", () => {
  const a = new Controller(),
    b = new Controller();
  for (let i = 0; i < 120; i++) {
    a.step(1 / 60, { forward: true });
    b.step(1 / 60, { forward: true, right: true });
  }
  assert.ok(Math.abs(Math.hypot(b.x, b.z - 7) - Math.abs(a.z - 7)) < 0.01);
});
test("slide along obstacle not through", () => {
  const c = new Controller({
    x: 0,
    z: 0,
    colliders: [{ x: 0, z: -2, w: 2, d: 1 }],
  });
  for (let i = 0; i < 120; i++) c.step(1 / 60, { forward: true });
  assert.ok(c.z > -1.25);
  for (let i = 0; i < 90; i++) c.step(1 / 60, { forward: true, right: true });
  assert.ok(c.x > 2);
});
test("walkable limits, no long frame teleport", () => {
  const c = new Controller({
    x: 0,
    z: 0,
    walkable: (x, z) => Math.abs(x) < 1 && Math.abs(z) < 1,
  });
  c.step(9, { forward: true });
  assert.ok(c.z > -1);
});
test("interaction only nearby, deterministic nearest", () => {
  assert.equal(
    nearestInteraction({ x: 0, z: 0 }, [{ id: "far", x: 0, z: 10 }]),
    null,
  );
  assert.equal(
    nearestInteraction({ x: 0, z: 0 }, [
      { id: "a", x: 0, z: 1 },
      { id: "b", x: 0, z: 0.5 },
    ]).id,
    "b",
  );
});
