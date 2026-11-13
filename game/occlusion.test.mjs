import test from "node:test";
import assert from "node:assert/strict";
import * as T from "./vendor/three.module.js";
import { makeOcclusion } from "./occlusion.js";
test("geometry between subject and lens fades, then restores without camera push-in", () => {
  let g = new T.Group(),
    m = new T.MeshStandardMaterial(),
    box = new T.Mesh(new T.BoxGeometry(2, 3, 0.2), m);
  box.position.set(0, 1, 3);
  g.add(box);
  g.updateMatrixWorld(true);
  let o = makeOcclusion(),
    cam = new T.Vector3(0, 1, 6);
  o.update(new T.Vector3(0, 1, 0), cam, [g]);
  assert.equal(box.material.opacity, 0.08);
  assert.deepEqual(cam.toArray(), [0, 1, 6]);
  o.update(new T.Vector3(4, 1, 0), new T.Vector3(4, 1, 6), [g]);
  assert.equal(box.material, m);
});
