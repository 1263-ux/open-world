import test from "node:test";
import assert from "node:assert/strict";
import * as T from "./vendor/three.module.js";
import { Controller } from "./controller.js";
import { makeWorld, authoredFootprint } from "./world.js";
import { createStory } from "./narrative.js";
import { createDirectFold } from "./direct-fold.js";
test("actual controller+authored navigation+direct folds+story full round trip (simulation, not browser play)", () => {
  const w = makeWorld(new T.Scene());
  w.colliders[0] = { x: -0.85, z: -2.1, w: 2, d: 0.84 };
  w.colliders.push({ x: -1.25, z: -3.3, w: 2.9, d: 0.65 });
  const p = new Controller({
      x: 0.5,
      z: 6.7,
      walkable: (x, z, b) => authoredFootprint(x, z, b, w.walkable),
      colliders: w.colliders,
    }),
    s = createStory();
  const folds = createDirectFold({story:s,position:()=>p,location:i=>w.folds[i].g.position});
  let elapsed = 0;
  const tick = () => {
    s.tick(1 / 60, {
      speed: p.speed,
      zone: p.z < -56 ? "sunset" : p.z > -10 ? "office" : "river",
    });
    folds.update(1 / 60);
    elapsed += 1 / 60;
  };
  const move = (x, z) => {
    for (let n = 0; n < 5000; n++) {
      const dx = x - p.x,
        dz = z - p.z;
      if (Math.hypot(dx, dz) < 0.18) {
        for (let i = 0; i < 30; i++) {
          p.step(1 / 60, {});
          tick();
        }
        return;
      }
      p.step(1 / 60, {
        right: dx > 0.08,
        left: dx < -0.08,
        backward: dz > 0.08,
        forward: dz < -0.08,
      });
      tick();
    }
    assert.fail(`stuck approaching ${x},${z} at ${p.x},${p.z}`);
  };
  const use = (id, x, z) => {
    const r = s.interact(id, {
      distance: Math.hypot(x - p.x, z - p.z),
      maxDistance: 2.3,
    });
    assert.equal(r.ok, true, `${id} at ${p.x},${p.z}`);
    return r;
  };
  move(0.5, -0.7);
  use("letter", 0, -2);
  move(2, -0.7);
  move(1, -4.5);
  move(0, -5.1);
  move(0, -20);
  for (let i = 0; i < 3; i++) {
    const pos = w.folds[i].g.position;
    move(pos.x, pos.z);
    for (let n = 0; !s.snapshot().solved[i] && n < 4; n++) {
      assert.equal(folds.start(i),true);
      for(let frame=0;frame<20;frame++){p.step(1/60,{});tick();}
    }
    assert.equal(s.snapshot().solved[i],true,`direct spatial fold ${i}`);
  }
  move(0, -28);
  use("boat", 0, -28);
  p.boating = true;
  for (const [x, z] of [
    [0, -37],
    [10, -37],
    [10, -54],
    [0, -54],
    [0, -61],
  ])
    move(x, z);
  assert.equal(s.snapshot().stage, "sunset");
  use("return", 0, -61);
  for (const [x, z] of [
    [0, -54],
    [10, -54],
    [10, -37],
    [0, -37],
    [0, -28],
  ])
    move(x, z);
  p.boating = false;
  p.z = -27;
  for (const [x, z] of [
    [0, -22],
    [0, -10],
    [0, -5.1],
    [1, -4.5],
    [2, -0.7],
    [0.5, -0.7],
  ])
    move(x, z);
  assert.equal(s.snapshot().stage, "echo");
  use("echo", 0, -2);
  for (let i = 0; i < 94; i++) s.tick(1, { zone: "office" });
  assert.equal(s.snapshot().collected, true);
  assert.equal(s.snapshot().stage, "complete");
  console.log(
    `Simulated movement time ${elapsed.toFixed(1)}s; no hidden position edits except explicit dock disembark transition.`,
  );
});
