import test from "node:test";
import assert from "node:assert/strict";
import { frameTime } from "./frame-time.js";
test("low FPS limits movement but preserves elapsed story time", () => {
  assert.deepEqual(frameTime(2000, 1000), { wall: 1, physics: 0.5 });
  let elapsed = 0;
  for (let n = 1; n <= 93; n++)
    elapsed += frameTime(n * 1000, (n - 1) * 1000).wall;
  assert.equal(elapsed, 93);
  assert.deepEqual(frameTime(1000, 1000), { wall: 0, physics: 0 });
});
