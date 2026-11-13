import test from "node:test";
import assert from "node:assert/strict";
import { environmentAnchor } from "./shot-environment.js";
test("memory sunset lights and sky follow the shot, not the postal return location", () => {
  const player = { x: 0, y: 0, z: -2 },
    focus = { x: 0, y: 1, z: -61 };
  assert.deepEqual(environmentAnchor("memory", player, focus), focus);
  assert.deepEqual(environmentAnchor("echo", player, focus), player);
  assert.equal(
    environmentAnchor("memory", player, { x: -0.4, y: 1, z: -2.1 }).z,
    -2.1,
  );
});
