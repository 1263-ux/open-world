import test from "node:test";
import assert from "node:assert/strict";
import { memoryClipTime } from "./memory-pose.js";
test("memory clip has opening hold, deterministic seek and settled final pose", () => {
  assert.equal(memoryClipTime(73, 73, 6), 0);
  assert.equal(memoryClipTime(74, 73, 6), 0);
  assert.equal(memoryClipTime(77, 73, 6), 3);
  assert.equal(memoryClipTime(89, 73, 6), 6);
  assert.equal(memoryClipTime(NaN, 73, 6), 0);
});

test("leaving an isolated cinematic also cuts, including skip during C06", async () => {
  const { shouldCutShot } = await import("./memory-pose.js");
  assert.equal(shouldCutShot("C06:true", null), true);
  assert.equal(shouldCutShot("C06:true", "C07:false"), true);
  assert.equal(shouldCutShot(null, "C01:false"), true);
  assert.equal(shouldCutShot("C06:true", "C06:true"), false);
  assert.equal(shouldCutShot(null, null), false);
});
