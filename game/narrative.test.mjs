import assert from "node:assert/strict";
import { createStory, FOLDS, MEMORY_ID } from "./narrative.js";
const near = { distance: 1 };
function reachMemory(stay = false) {
  const t = createStory();
  assert.equal(t.interact("letter").ok, false);
  assert.equal(
    t.interact("letter", { distance: 50, maxDistance: 100 }).ok,
    false,
  );
  assert.equal(t.interact("letter", near).ok, true);
  assert.equal(t.interact("fold:1:pour", near).ok, false);
  for (let i = 0; i < 3; i++) {
    assert.equal(
      t.interact(`fold:${i}:pour`, near).events[0].type,
      "fold-hint",
    );
    for (let n = 0; t.snapshot().folds[i] !== FOLDS[i].target && n < 4; n++)
      t.interact(`fold:${i}:rotate`, near);
    assert.equal(
      t.interact(`fold:${i}:pour`, near).events[0].type,
      "water-connected",
    );
    assert.equal(t.interact(`fold:${i}:rotate`, near).ok, false);
  }
  assert.equal(t.snapshot().stage, "ready");
  t.interact("boat", near);
  assert.equal(t.interact("return", near).ok, false);
  t.interact("rain", near);
  assert.equal(t.interact("rain", near).ok, false);
  t.tick(1, { zone: "sunset", speed: 1 });
  if (stay) t.tick(5, { zone: "sunset", speed: 0 });
  assert.equal(t.snapshot().sunsetStay, stay ? 5 : 0);
  t.interact("return", near);
  t.tick(1, { zone: "office" });
  t.interact("echo", near);
  return t;
}
let t = reachMemory();
t.interact("pause");
t.tick(30, {});
assert.equal(t.snapshot().memoryTime, 0);
assert.equal(t.interact("skip").ok, false);
t.interact("resume");
t.tick(30, { paused: true });
assert.equal(t.snapshot().memoryTime, 0);
t.tick(10, {});
assert.equal(t.snapshot().memoryTime, 10);
t = createStory(t.snapshot());
assert.equal(t.snapshot().stage, "memory");
let result = t.interact("skip");
assert.equal(result.events.filter((e) => e.type === "collected").length, 1);
assert.equal(result.events[0].id, MEMORY_ID);
assert.equal(t.interact("skip").ok, false);
assert.equal(t.tick(10, {}).events.length, 0);
t.interact("collection", near);
t = createStory(t.snapshot());
assert.equal(t.snapshot().stage, "memory");
assert.equal(
  t.interact("skip").events.filter((e) => e.type === "collected").length,
  0,
);
const natural = reachMemory(true);
natural.tick(60, {});
result = natural.tick(33, {});
assert.equal(result.state.stage, "complete");
assert.equal(result.events.filter((e) => e.type === "collected").length, 1);
assert.equal(natural.tick(1, {}).events.length, 0);
for (const bad of [
  null,
  {},
  { ...natural.snapshot(), version: 8 },
  { ...natural.snapshot(), folds: [0, 0, 0] },
  { ...natural.snapshot(), memoryTime: Infinity },
  { ...natural.snapshot(), solved: [true, false, true] },
])
  assert.equal(createStory(bad).snapshot().stage, "letter");
const copy = t.snapshot();
copy.folds[0] = 999;
assert.equal(t.snapshot().folds[0], 1);
console.log(
  "PASS: proximity, ordered orientation puzzle, success locks, optional exploration/stay, return, pause, save validation, replay, skip/natural completion idempotence",
);
