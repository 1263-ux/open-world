import test from "node:test";
import assert from "node:assert/strict";
import {
  createProgressSave,
  bindProgressLifecycle,
  captureInteraction,
  allowSafetyReset,
  validateLoadedPosition,
} from "./progress-save.js";
import { createStory, FOLDS } from "./narrative.js";
import { Controller } from "./controller.js";
import { makeWorld, authoredFootprint } from "./world.js";
import { restorePlayer, safeAnchor } from "./session.js";
import * as T from "./vendor/three.module.js";
import fs from "node:fs";
test("asset-loaded collider revalidation actually recovers trapped restored player", () => {
  const world = makeWorld(new T.Scene()),
    story = createStory();
  story.interact("letter", { near: true });
  const p = new Controller({
    walkable: world.walkable,
    colliders: world.colliders,
  });
  Object.assign(
    p,
    restorePlayer(
      { story: story.snapshot(), player: { x: -2.5, z: -3.3, boating: false } },
      story.snapshot(),
      world,
    ),
  );
  world.colliders[0] = { x: -0.85, z: -2.1, w: 2, d: 0.84 };
  world.colliders.push({ x: -1.25, z: -3.3, w: 2.9, d: 0.65 });
  const old = p.walkable;
  p.walkable = (x, z, b) => authoredFootprint(x, z, b, old);
  assert(p.blockedAt(p.x, p.z));
  assert.equal(
    validateLoadedPosition(p, () =>
      Object.assign(p, safeAnchor(story.snapshot().stage)),
    ),
    false,
  );
  assert(!p.blockedAt(p.x, p.z));
});
test("modal callbacks capture fixed ID but revalidate current distance; R forbidden", () => {
  const story = createStory();
  story.interact("letter", { near: true });
  let near = { id: "fold:0:rotate", x: -4, z: -22 },
    p = { x: -4, z: -22 };
  const act = captureInteraction(
    near,
    () => p,
    story,
    (r) => r,
  );
  near = null;
  assert(act().ok);
  p = { x: 0, z: 7 };
  assert.equal(act().ok, false);
  assert.equal(story.snapshot().folds[0], 1);
  assert.equal(allowSafetyReset(true), false);
  assert.equal(allowSafetyReset(false), true);
});
test("immediate state/collection checkpoints, lifecycle, wall seconds and storage failures", () => {
  const story = createStory();
  let stored,
    count = 0;
  const read = () => ({
    story: story.snapshot(),
    player: { x: 0, z: 0, boating: false },
  });
  const save = createProgressSave({
    storage: {
      setItem(k, v) {
        stored = JSON.parse(v);
        count++;
      },
    },
    read,
  });
  save.changed();
  story.interact("letter", { near: true });
  save.changed();
  assert.equal(stored.story.stage, "folds");
  for (let i = 0; i < 3; i++) {
    for (let j = 0; story.snapshot().folds[i] !== FOLDS[i].target && j < 4; j++)
      story.interact(`fold:${i}:rotate`, { near: true });
    story.interact(`fold:${i}:pour`, { near: true });
    save.changed();
    assert(stored.story.solved[i]);
  }
  story.interact("boat", { near: true });
  story.tick(1, { zone: "sunset" });
  story.interact("return", { near: true });
  story.tick(1, { zone: "office" });
  story.interact("echo", { near: true });
  story.interact("skip");
  save.changed();
  assert(stored.story.collected);
  assert.equal(createStory(stored.story).snapshot().stage, "complete");
  const before = count;
  save.tick(4);
  assert.equal(count, before);
  save.tick(1.1);
  assert.equal(count, before + 1);
  const listeners = {};
  const doc = {
    hidden: true,
    addEventListener: (k, v) => (listeners[k] = v),
    removeEventListener: (k) => delete listeners[k],
  };
  const win = { ...doc };
  const unbind = bindProgressLifecycle(save, doc, win);
  listeners.visibilitychange();
  listeners.pagehide();
  assert.equal(count, before + 3);
  unbind();
  assert.equal(Object.keys(listeners).length, 0);
  const broken = createProgressSave({
    storage: {
      setItem() {
        throw Error("quota");
      },
    },
    read,
  });
  assert.equal(broken.flush(), false);
});
test("main uses safe helpers and saves disembarkation, without stale near closure", () => {
  const source = fs.readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert(source.includes("validateLoadedPosition(player, recoverPlayer)"));
  assert(source.includes("allowSafetyReset(panel.open)"));
  assert(source.includes("progressSave.changed()"));
  assert(source.includes("progressSave.tick(wall)"));
  assert(!source.includes("story.interact(near.id"));
  assert.match(source, /player.z = -27;\s*progressSave.flush\(\)/);
});

test('quota failures retry only at new critical state or interval, and notify on recovery once',()=>{
 let calls=0,fail=true;const notices=[],story=createStory();const save=createProgressSave({storage:{setItem(){calls++;if(fail)throw Error('QuotaExceededError');}},read:()=>({story:story.snapshot()}),onStatus:ok=>notices.push(ok)});
 assert.equal(save.changed(),false);for(let i=0;i<300;i++)save.changed();assert.equal(calls,1);assert.deepEqual(notices,[false]);
 story.interact('letter',{near:true});save.changed();assert.equal(calls,2);save.tick(4.9);assert.equal(calls,2);save.tick(.1);assert.equal(calls,3);assert.deepEqual(notices,[false]);
 fail=false;save.tick(5);assert.equal(calls,4);assert.deepEqual(notices,[false,true]);for(let i=0;i<300;i++)save.changed();assert.equal(calls,4);save.tick(5);assert.deepEqual(notices,[false,true]);
 fail=true;save.tick(5);assert.deepEqual(notices,[false,true,false]);
});
