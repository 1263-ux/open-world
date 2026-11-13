# Reconstructed opening runtime, 2026-11-13

These six source files were reconstructed from the parent thread's recorded writes and corrections after an execution-environment restart. They were not recovered from Library v5 and are not claimed byte-identical to the lost working files.

Install location within the restored v5 project: new-realigned-slice/playable/. Serve the project root and open /new-realigned-slice/playable/.

Dependencies already restored and checked by the parent: ../environment-layout-candidate.glb (SHA256 62e45c31eca3dafecc819618d9fc638ccbed35b9fba808912e368a88a81f15fa), ../layout.json, ../../character-lookdev/b2/courier-b2-candidate.glb (SHA256 37b277cdd74b11774ced4ca238f94fb49a3da4ca4266635be2ec68922ef31dc1), existing game/vendor and story/controller/occlusion/frame-time modules, existing licensed HDRI preview. No runtime-contract.json was restored or invented.

Historical placement contract retained in implementation: spawn (2.5,0,6.5), initial camera (4.5,1.8,10), FOV48, B2 scale .78. Camera follows the actor rather than remaining aimed at the offline editorial look-at point. Letter center (-2.78,.987,-3.64), suggested approach (-2.2,0,-3.7), actual ground-ray support takes ground surface height. Bridge Y0; platform top about -.08; path stones top about .025. Blender and Three lighting are not equivalent, and the runtime light values remain unverified starting values.

Verification rerun after this reconstruction:
- node --check on all six JS/MJS sources: passed.
- test.mjs: actual fixed-step path from spawn to letter, table/void blocked: passed.
- geometry-test.mjs: real GLB geometry with doubleSided material rule retained, 24 ground meshes / 14 colliders, 276 movement samples; height range [-.0799999982,.0249999994]: passed.

The five-point 9cm footprint prevents a center ray falling between bridge planks. Bridge length is not artificially shortened at the platform join. GLTFLoader underscore-normalized node names are normalized before matching. The geometry test drops texture decoding but retains sidedness; it does not verify rendered materials, lighting, performance or gameplay feel.

Reading still uses the original INTRO text in a modal. No hand-held letter action or ReadLetter clip exists here. No new browser playtest was performed in this reconstruction; the parent previously verified a WebGL failure UI, not gameplay. Nothing was deployed and stable game/ was not changed.
