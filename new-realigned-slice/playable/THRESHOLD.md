# Opening dream threshold: experimental integration

This is an agent-authored continuation hypothesis for CH01, not a final chapter, reward, or change to original story canon. Read completion reveals the reused actual 3D companion bay. No duplicate proxy courier is shown. The preview boat is docked sideways to avoid intersecting the narrow landing. Only three tiny temporary ink droplets lead from the letter toward the incomplete arch; there is no neon portal.

## Integration contract

- Construct `createDreamThreshold(scene)` once. Call `reveal()` only after the physical letter has been returned and the reading action completes. It is idempotent.
- Call `update(wallTime, delta, worldPlayer, {paused})`; do not advance while paused. Reveal is 3.2s.
- Hint only when `canBoard(worldPlayer)`; E calls `startBoard(worldPlayer)`. During `snapshot().phase === 'boarding'`, lock controller input and display `getBoardPose()` for the .8s local transition.
- After update, consume `takeArrival()` once. Apply its x/z/heading; change the existing controller walkable to `navigable`, colliders to [], boating to true. Keep a single player. The module holds the boat at the dock until arrival is consumed.
- The arrival is (2,-13.1), actor Y .04065; boat Y .06 and seat local Y .185 are the existing boat/rig contract. The reused boat's dimensions/seat are unchanged. This is only interpolated boarding with pose crossfade, not authored entry animation.
- For sailing, update receives the same world-space controller. `toLocal` subtracts (2,-19); `toWorld` adds it. Navigation closure converts world to bay coordinates internally.
- Hint folding only when `canFold(player)` and invoke `foldAt(player)`. Both require boating, raised fold, and local distance <=3 from (0,-3). The physical fold animates and changes the existing flow, not a UI reward flag.
- The module does not own camera, save, chapter completion, UI, or the player's rig. Parent integrates those independently.

## Evidence and limits

`dream-threshold.test.mjs`: 4 tests for explicit reveal/pause, continuous local boarding and one-shot arrival, both actual Controller bay routes and folding, arrival pending/interaction conditions.
`threshold-join-test.mjs`: actual currently selected edge-fade GLB ground and collision, 294 fixed steps from the letter to the dock; not a browser playtest. Successful route goes right around actual wall, not directly through it. Final standing (2.011,-11.363); ground -.08. Boat bbox z max -12.36, platform end -12: .36m gap, no intersection. The bay reaches z=-11, beneath the tongue. Navigation tests are center-based, NOT a proof of full hull collision at every shore.

`export-threshold.mjs` exports the actual bay meshes with GLTFExporter 0.186.1 (same Three r186 major revision); `render-threshold.py` imports the actual postal edge-fade GLB plus bay GLB into Blender Cycles CPU. Any output is an offline geometry/material comparison, not WebGL evidence or real gameplay. Browser WebGL remained unavailable. No claim that visual target has passed.

Scene edit outside this module: `companion-bay-lookdev/scene.js` adds backward-compatible `showCourier=true` option and returns `courier`; old callers retain the courier. This module passes false.

## Combined offline review: not passed

First combined render exposed a genuine pier collision that the initial platform-only test missed. The dock was moved .2m farther into the bay and the join test now checks the complete boat AABB against every actual GLB collider. This proves only the initial dock clearance, not the full swept sailing hull. The earlier water-edge variant still containing this pier clash is retained as `B-soft-edge-still-pier-clash.png`.

Opening-specific overrides hide the original thick cylinder water and all 36 ball banks, and replace them with a shallow elliptical surface with real RGBA vertex fading. The island is thinned and recolored, without changing its tested blocked footprint. The original standalone bay retains its original appearance.

The final `through-arch.png` was actually inspected: the pier no longer intersects the boat, the toy ball rim is gone, and the bay is spatially visible. However the glass/fish remain weak, the distant fold reads like an upright white board, the central island still looks like a primitive rectangle, and the faded water can read like fog-covered ground. These are remaining art/meaning issues, NOT a passed reference-quality review. Rendering is low-sample CPU and has visible noise. Do not publish this as a finished game.
