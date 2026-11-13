import test from "node:test";
import assert from "node:assert/strict";
import { boatPose } from "./boat-state.js";
test("boat is a real dock landmark before boarding and remains docked after disembarking", () => {
  const p = { x: 2, z: -2, boating: false, heading: 1 };
  for (const stage of [
    "letter",
    "folds",
    "ready",
    "returning",
    "echo",
    "complete",
  ])
    assert.deepEqual(boatPose(stage, p), { x: 0, y: 0.06, z: -28, heading: 0 });
  assert.deepEqual(boatPose("sailing", { ...p, boating: true }), {
    x: 2,
    y: 0.06,
    z: -2,
    heading: 1,
  });
  assert.deepEqual(boatPose("memory", p), {
    x: 0,
    y: 0.06,
    z: -61,
    heading: Math.PI,
  });
});
