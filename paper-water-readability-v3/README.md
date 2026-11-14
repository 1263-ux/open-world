# V3: a bounded paper-water visibility test

This is one isolated continuation of the frozen `paper-water-readability` snapshot. It changes only the right-hand near lip of the existing gutter/catchment and proposes a temporary interaction-feedback camera. It does not redesign the island, navigation, paper hinge, pull tabs, receiver, boat, fish or character. Nothing is imported by the live game or published Site.

## Why and exact changes
The v17 restored eye-level image hid most of the water behind the actor and a nearly edge-on channel. More surface detail would not solve that. The near gutter lip is now 0.025 m versus the far lip's 0.06 m; the catchment's near folded return is lowered consistently. Water geometry and functional endpoints stay the same.

The feedback view is world position `(9, 2.5, -25.5)`, looking toward `(3.1, 0.7, -22.5)`, vertical FOV 48°. Boat/actual B2 remain at the real right pull-tab vicinity `(4.9, -22.45)`, with the original seated scale, height and orientation. This 2.5 m camera is a proposed short-lived feedback view, **not** the default exploration eye. It is not a pure overhead diagram.

`focus-camera.js` is a pure optional pose helper. The caller must explicitly opt into feedback; weight 0 returns the current exploration pose exactly. It does not store or mutate orbit/input, lock the player, or modify the main camera. Integration, easing, input interruption and browser feel are not tested here.

## Reproduce
1. `node paper-water-readability-v3/export-interaction.mjs`
2. `blender --background --threads 2 --python paper-water-readability-v3/render-interaction.py`
3. `node --test paper-water-readability-v3/*.test.mjs`

The export script uses the official Three exporter already installed in sibling `open-world/node_modules`; geometry uses the existing game vendor engine. The render imports the real B2 GLB and actual Sitting_Rig. CPU Cycles, 32 samples, no denoising, 1000×700. Both states share the same lighting and camera. No generated concept board substitutes for a real scene. These images are not browser screenshots, performance evidence or gameplay acceptance.

Three focused tests pass: source/navigation/boat/hinge/pull-tab contracts remain unchanged; static spill/connection endpoints agree; focus/release is reversible and does not mutate the current exploratory input. Boolean receiver appearance remains an unfinished transition. No fluid-front animation is claimed.

## Actual final-image review and decision
Both final images were inspected after the render process finished. The raised state keeps the dry receiver and the interrupted source visible. In the flowing state the source, the length of the pale cyan channel, the narrowed outlet/fall, and the wet receiver can now be seen together, while the actual boat, courier and fishbowl remain in frame. The former actor/edge-on occlusion is materially reduced in this fixed feedback view. **The bounded path-visibility experiment improved.**

This is not overall aesthetic acceptance. The source still resembles a paper table, the water is stylized and tape-like, the palette/atmosphere are below the V2 target, and the raised flap tip is cropped. The result depends on the proposed temporary feedback view; default exploration visibility has not been magically fixed. It has not been played in a WebGL browser. The next integration gate would be a smooth, interruptible feedback camera and advancing water front, not a claim that a boolean wet-receiver switch is finished gameplay.

Snapshot rule: all files in manifest were frozen after final export/render/test/review. Future experiments must use a new directory or version, not overwrite this evidence.
