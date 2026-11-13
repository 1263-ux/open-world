import test from "node:test";
import assert from "node:assert/strict";
import * as T from "./vendor/three.module.js";
import { createLightIsolation } from "./reality-scene.js";
test("real-world memory isolates lights and restores previously disabled lights correctly", () => {
  const s = new T.Scene(),
    local = new T.Group(),
    a = new T.DirectionalLight(),
    b = new T.PointLight(),
    c = new T.HemisphereLight();
  b.visible = false;
  s.add(a, b, local);
  local.add(c);
  const i = createLightIsolation(s, local);
  i.set(true);
  assert.equal(a.visible, false);
  assert.equal(b.visible, false);
  assert.equal(c.visible, true);
  const late = new T.PointLight();
  s.add(late);
  i.set(true);
  assert.equal(late.visible, false);
  i.set(false);
  assert.equal(a.visible, true);
  assert.equal(b.visible, false);
  assert.equal(c.visible, true);
  assert.equal(late.visible, true);
});
