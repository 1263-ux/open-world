import test from "node:test";
import assert from "node:assert/strict";
import { safeAnchor, restorePlayer } from "./session.js";
const world = {
  walkable: () => true,
  colliders: [{ x: 0, z: -3, w: 2, d: 1 }],
};
test("sailing recovery preserves transport", () => {
  assert.equal(safeAnchor("sailing").boating, true);
  assert.equal(safeAnchor("sunset").boating, true);
});
test("invalid story and legitimate water location reset together", () => {
  const p = restorePlayer(
    { story: { stage: "invalid" }, player: { x: 0, z: -61, boating: true } },
    { stage: "letter" },
    world,
  );
  assert.deepEqual(p, safeAnchor("letter"));
});
test("stage and collision checked together", () => {
  assert.deepEqual(
    restorePlayer(
      { story: { stage: "sailing" }, player: { x: 0, z: 7, boating: false } },
      { stage: "sailing" },
      world,
    ),
    safeAnchor("sailing"),
  );
  assert.deepEqual(
    restorePlayer(
      { story: { stage: "folds" }, player: { x: 0, z: -3, boating: false } },
      { stage: "folds" },
      world,
    ),
    safeAnchor("folds"),
  );
});
