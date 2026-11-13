# Independent receiving-space walk/read experiment

Serve the entire project root, open `/new-realigned-slice/playable/`. Not the published v6 game and not an accepted entry. It is a local exploratory successor to the rebuilt opening, not recovered old candidate code.

Uses real receiving-space-v2 GLB, B2 walking character, fixed-step Controller, actual surface raycasts and wall collisions. Scene ground support uses five foot-area rays; GLTFLoader-normalized names are respected. A 276-sample route to the receiving area and the Y0 interaction landing have been verified against actual GLB geometry (Node material appearance omitted, sidedness retained).

ReadLetter is a separate deterministic rig+paper scene at the exact physical desk contract. The paper remains in that fixed scene while inactive; original static paper/ink are hidden, so no carried desk-paper or duplicate letter. The player must approach within0.55m on the right and an alignment sweep must be collision-free. A short0.45s local alignment precedes pickup, which stops at1.50s until the reader closes the text; return proceeds to3.0s. Holding/repeated activation/paused time/return/replay are covered by pure clock and actual GLB animation tests. There is no independent runtime parent teleport of the paper. The walking actor is hidden only while the gesture actor performs, then restored at the same position.

Not yet proven: full rendered animation transitions, gesture-camera occlusion across viewport sizes, browser performance and tactile movement. Current cloud CUA has WebGL2 unavailable; safe local Chromium launch fails before a page due local socket restrictions. Offline Blender images and Node tests are not gameplay evidence. Do not deploy this page as reference-quality final work.

Checks: `node test.mjs`, `node geometry-test.mjs`, `node --test letter-action.test.mjs gesture-view.test.mjs` from this directory; `node --check main.js`. Actual gesture GLB texture decoding is not exercised by Node; geometry, skeletons, clips and sidedness are preserved while material images are omitted for that test.

### Latest integrated candidate
Final edge-fade asset is selected only here; stable game unchanged. Actual GLB geometry passes 276 route samples, 27 ground meshes and 14 colliders, including Y=0 under the letter stance. ReadLetter uses the exact physical clip/paper, a side composition with vertical FOV 27.1 eased from/to exploration 48. Desktop letter panel is left-aligned and mobile bottom-aligned; this CSS has not been visually verified in a functioning WebGL browser. Runtime lighting is an approximation, not numerically equal to Blender.

The read-to-dream threshold is being integrated as the next continuous segment, not a complete chapter or accepted game. Offline rendering, source-level controllers and actual GLB/Mixer tests are distinct evidence; none establishes gameplay feel, transparency sorting or reference-quality acceptance.

First integrated threshold offline image was actually reviewed and **rejected**: arch pillar overlaps boat left side despite center-point route tests, and circular water tray / repetitive spherical bank restores the rejected graybox aesthetic. This is a failed A/B checkpoint, not a candidate ready for publication. Whole-hull clearance and restrained spatial treatment are being corrected independently before any deployment.
