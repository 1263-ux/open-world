# Companion composition study

Agent-designed, isolated experiment. Source: `../seated-context.blend`, which uses actual experimental threshold GLB and B2 Sitting_Rig. No canonical asset, actor position, boarding path, hull, main program or Site changed.

## Why
CH01 says the fish is a visible companion in a small transparent chamber by the boat, and key shots should retain both courier and fish. V2 says warmth should come from the relationship, not excessive decoration. D's bowl is behind the courier; rotating the camera cannot make them share the forward view.

## Concrete proposal
Move the **entire unchanged-size bowl assembly**, rim/water/highlights/fish plus folded paper support, from boat local `(0.35, 0.46, -0.5)` to `(0.27, 0.46, 0.78)`. This is the far side from the boarding step (positive local X, while boarding is negative local X). The original B2 sitting pose and root are unchanged. A slightly closer side camera targets the two companions, not the central paper device. Rest-state fish faces toward the courier rather than directly toward the camera. This proposed gaze is a posed behavior cue, not evidence the runtime already does it.

## Evidence and limits
`render.py` is reproducible with Blender CPU, 1000×700, 48 samples, no denoising. `geometry-review.json` checks evaluated geometry at this one actual seated pose. Hidden rig-control Icosphere was initially counted, then correctly excluded via visibility. Remaining intersection pairs are the three support feet meeting the boat floor; no rendered actor or gunwale intersection appears in this surface test. This is not a full boarding animation test or proof of no containment.

Initial E was actually inspected: spatial relationship is substantially more readable than D, but the fish facing camera still looked like a dot. A second render turns the fish toward the courier without increasing its dimensions. Final review follows below after pixels are inspected. Do not adopt automatically or call this reference quality: water still resembles a matte plane, background paper device is oversized/clinical, and this is neither a browser screenshot nor a gameplay/performance test.

## Final E2 review
E2-forward-companion.png was actually viewed at full size. The whole supported bowl in front-side space reads as a companion rather than luggage behind the courier; fish body plus triangular tail are now visible. No scale increase. The first Euler assignment had silently failed because the imported object used quaternion rotation; `rotation_mode='XYZ'` is now explicitly set. The first image viewer repeatedly returned a tiny sky preview despite a valid 1000×700 file; a unique output name provided a full view. Do not use the invalid tiny view as visual evidence.

Current fish envelope at this posed sample: max radial extent **0.205341 m** within 0.26 m spherical bowl; max local vertical **0.0648 m** below the 0.12 m waterline. This does not verify every future animated orientation/swim state. The single missing visible eye is still a model/readability limitation at this distance; tail silhouette is improved, not final character polish.

## Integration contract (not yet adopted)
- Bowl center Three local: `(0.27, 0.46, 0.78)`; support tray `(0.27, 0.18, 0.78)`.
- Rigid delta for all bowl/support/rim/water/side-glint objects: `(-0.08, 0, +1.28)`; nested fish follows bowl without applying delta twice.
- At dock yaw PI/2 and boat world `(2, .06, -13.1)`, bowl center world `(2.78, .52, -13.37)`.
- Stand remains `(2,-.08,-12.03)`; boat/seat/actor unchanged. Full boarding animation still needs this candidate fixture as a new collision check, not merely root distance.
- Rest-state proposed fish yaw is Three `+PI/2` relative to bowl, facing courier. **Do not lock all swim states to this angle**. Blend from current direction only during calm/rest; motion and other interests remain authored by companion behavior.
- E2 camera Three `(3.55,1.62,-9.6)`, target `(2.32,.78,-13.3)`, Blender 38mm horizontal sensor36 at 1000×700. F2 uses the unmodified original D exploratory camera (yaw .35/zoom4.1/FOV48) to separate the bowl-placement result from camera changes.

Keep this an isolated candidate until direct explorer camera, animation/boarding collision, transparent sorting, real gameplay and performance tests can run. No changes to stable game or published Site.

F2 was actually inspected at full size with the original D camera. Both fish body and tail remain readable in front of the courier, so the local improvement is not dependent on the tighter E2 camera. Overall scene remains below V2: hard slate-like water/shore and clinical fold device dominate depth; no claim of overall art acceptance.

## Optional runtime helper (not enabled in main)
Parent has now added an explicit `bay.bowlAssembly` group containing the original bowl/rim/water/support plus art highlights, with zero baseline transform. `placement.js` uses this API, not Blender mesh indices or geometry heuristics. Creating a controller does nothing; `setEnabled(true)` shifts the whole group once, `false` restores the captured baseline. It does not alter swim behavior.

Four Node tests passed against actual `makeBay` + `applyBayArt`: default/reversible/idempotent placement; all real meshes follow the same transformed delta without scale/geometry/parent changes; folded support feet reach the floor within its rectangular central section; actual fish geometry including tail/eye stays underwater and within the .26 m spherical bowl over 256 swim headings. This is bounded geometric evidence, not proof of collision-free full boarding motion, viewport visibility from every orbit angle, transparent rendering, or real-time play.
