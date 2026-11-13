import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "./vendor/three.module.js";
import { makeWorld } from "./world.js";
// Executes the current owned construction code with the real Three geometry, not a duplicate mathematical model.
function fixture() {
  const scene = new T.Scene(),
    world = makeWorld(scene),
    src = fs.readFileSync(new URL("./main.js", import.meta.url), "utf8");
  const a = src.indexOf("const boat = new T.Group();"),
    b = src.indexOf("// Authored scene study");
  assert(a >= 0 && b > a);
  const objects = new Function(
    "T",
    "world",
    "scene",
    src.slice(a, b) +
      ";return {boat,bowl,fish,fishTail,rim,bowlWater,bowlTray,seat};",
  )(T, world, scene);
  scene.updateMatrixWorld(true);
  return { scene, ...objects };
}
test("actual bowl is open at the rim, closed at the bottom and supported at the tray top", () => {
  const f = fixture();
  const bounds = new T.Box3().setFromObject(f.bowl, false); // fish child does not exceed bowl envelope
  assert(Math.abs(bounds.max.y - 0.64) < 1e-6);
  assert(Math.abs(bounds.min.y - 0.2) < 1e-6);
  const tray = new T.Box3().setFromObject(f.bowlTray);
  assert(Math.abs(tray.max.y - bounds.min.y) < 0.003);
  const supporting = f.boat.children
    .filter(
      (o) => o.isMesh && o !== f.bowlTray && o !== f.bowl && o !== f.bowlWater,
    )
    .map((o) => new T.Box3().setFromObject(o));
  assert(
    supporting.some(
      (b) =>
        b.min.y < 0.002 &&
        b.max.y >= tray.min.y &&
        b.containsPoint(new T.Vector3(0.46, 0.08, -0.5)),
    ),
  );
});
test("fish mesh remains inside glass and below water across authored swim extremes", () => {
  const f = fixture();
  for (const x of [-0.05, 0.05])
    for (const z of [-0.16, 0.16])
      for (const tail of [-0.25, 0.25]) {
        f.fish.position.x = x;
        f.fish.rotation.z = z;
        f.fishTail.rotation.y = tail;
        f.scene.updateMatrixWorld(true);
        const center = f.bowl.getWorldPosition(new T.Vector3());
        f.fish.traverse((o) => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const v = new T.Vector3()
              .fromBufferAttribute(pos, i)
              .applyMatrix4(o.matrixWorld);
            assert(v.distanceTo(center) < 0.26);
            assert(v.y < 0.58);
          }
        });
      }
});
