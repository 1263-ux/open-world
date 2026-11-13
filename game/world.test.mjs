import test from "node:test";
import assert from "node:assert/strict";
import * as T from "./vendor/three.module.js";
import { makeWorld, authoredFootprint } from "./world.js";
test("continuous walking route from postal hub to all paper troughs and boat", () => {
  const w = makeWorld(new T.Scene());
  const path = [
    [0, 7],
    [3, 0],
    [3, -5],
    [0, -8],
    [0, -22],
    [-4, -22],
    [4, -22],
    [0, -28],
  ];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    for (let n = 0; n <= 100; n++) {
      const t = n / 100,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      assert.ok(w.walkable(x, z, false), `foot gap ${x},${z}`);
    }
  }
});
test("visible water rectangles contain continuous navigable ship path", () => {
  const w = makeWorld(new T.Scene());
  const path = [
    [0, -28],
    [0, -37],
    [10, -37],
    [10, -54],
    [0, -54],
    [0, -61],
  ];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    for (let n = 0; n <= 100; n++) {
      const t = n / 100,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      assert.ok(w.walkable(x, z, true), `boat gap ${x},${z}`);
    }
  }
});

test("authored hub disables invisible disc beyond bridge", () => {
  const w = makeWorld(new T.Scene());
  assert.equal(authoredFootprint(6, -7, false, w.walkable), false);
  for (let z = 6.7; z >= -22; z -= 0.1)
    assert.ok(authoredFootprint(0.5, z, false, w.walkable));
  assert.ok(authoredFootprint(-2, -0.5, false, w.walkable));
});
