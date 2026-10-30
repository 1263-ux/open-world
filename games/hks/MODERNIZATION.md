# HKS latest-feedback/art merge — isolated handoff

Prepared 2026-10-30 UTC under `/tmp/hks-modernized` only. No campus repository file or remote was written. No dependency installation, game execution, browser play, workflow trigger, commit or deployment occurred.

## Provenance and scope

Starting point was the parent's then-current `open-world/games/hks/src` plus relevant provenance, copied without node_modules, builds or root tooling. `PARENT_BASELINE_HASHES.json` fixes that snapshot. Parent-only changes to iframe entry/telemetry, Arrow keys, DEV debug gate, replay initialization, popup selection/timer guards, schedule()/AudioContext cleanup, VFX reset and Boss melee-range regression are retained.

Upstream improvements come from `ShanEior/Hks@3cb39bc86050edd0a909b7a5c9f56de0670a3d48` (2026-05-30 10:38:51 UTC), a descendant of the original port base `843ecbbae414a403eae350f4f8105cfbb84acf72`. This includes user `1263-ux`'s commits f9ad5b58, 67e502a3 and 07656139. User ownership/direct-port permission is complete; these are their existing project files, not newly invented replacement art or a replacement game. No unified third-party/open-source license is inferred or invented.

## Adoptable changed source files

| File | Change |
|---|---|
| src/HUD.ts | Latest fitted 286x340 card layout, CJK wrapping/readable encounter panel; preserve cancellation/generation and idempotent-choice fixes. Existing project illustrations fall back to generated monster textures. Aspect ratio is preserved for the portrait acid-rain illustration. |
| src/config.ts | Latest card dimensions, kill-text prefix and SKILL_FEEDBACK_MAP; no gameplay/balance values changed. |
| src/Monster.ts | Optional skipGenericSound, less-fatiguing 60/100ms hit tint. |
| src/SkillManager.ts | Correct three skill cast-sound mappings, seven skill-specific impact-sound routes, gentle cast burst, additional stone/lightning/spore impact effects; no damage/cooldown/repair/target-selection formulas changed. |
| src/SoundManager.ts | Add latest three cast and seven impact sound methods while retaining activate/dispose, tracked schedule(), stale-generation suppression and AudioContext cleanup. |
| src/VFX.ts | Latest directional impact particles, softer death flash, no full-screen level-up flash, stone/lightning/spore impact effects; retain reset(). |
| src/GameScene.ts | Add preload of only the seven materialized verified latest project PNGs. Existing lifecycle, target/collision logic and debug gate remain. The original latest bg.png is loaded as well; no removed sprite pack is requested. |
| src/Building.ts | Existing `gj` PNG preference is enabled by preload. Fit the portrait tower to 224px width, preserve aspect, anchor its bottom near the unchanged logical building base; fallback stays the original generated building. HP, damage and collision/range values unchanged. |

`src/main.ts`, `src/Player.ts`, `src/Boss.ts` and `src/combatRules.ts` are byte-identical to the parent's snapshot. Other original game classes/generators remain. Do not replace parent root package/Vite configuration or copy old .original directories. `MODERNIZATION.patch` is the exact diff against the parent snapshot; `MODERNIZED_INVENTORY.json` records resulting hashes. `.parent-baseline/` is provenance for those diffs, not a runtime input.

## Latest project PNGs

Original bytes were fetched from the pinned latest commit, verified against Git blob SHA, decoded/verified by Pillow and **viewed individually**. The images were not resized, recolored, regenerated or otherwise modified.

| File under public/assets | Dimensions | Runtime key | Modernized use |
|---|---:|---|---|
| building.png | 890x1176 RGBA | gj | Visible tower building; bottom-aligned while logical target stays unchanged |
| monster_acid_rain.png | 960x1280 RGBA | illus_acid_rain | Encounter popup illustration |
| monster_fire.png | 1024x1024 RGBA | illus_fire | Encounter popup illustration |
| monster_freeze_thaw.png | 1024x1024 RGBA | illus_freeze_thaw | Encounter popup illustration |
| monster_termite.png | 1024x1024 RGBA | illus_termite | Encounter popup illustration |
| monster_wind.png | 1024x1024 RGBA | illus_wind | Encounter popup illustration |
| bg.png | 2592x2096 RGBA | bg | Full gameplay background; generated fallback retained |

The five monster images are **opaque scenes with backgrounds**, not transparent combat sprites, so they are restored to the intended information-popup path only. Live monsters remain the original generated animated sprites. The tower has transparency; the background is a pixel-art grass/stone-path scene with bamboo, rocks and a cropped corner pavilion. Visually inspected source PNGs contain conspicuous saturated highlights/speckles/edges in the creature illustrations; these are present in the fetched originals and have not been silently corrected.

All seven materialized PNGs total **5,369,591 bytes**. Exact hashes, URLs and dimensions are in `ASSET_INVENTORY.json`. The parent's pre-modernization source did not load any of these external project images; the isolated source now loads these seven and uses their existing fallback paths.

### Background materialization — resolved

The >1MiB bg.png was initially empty through contents/base64 and rejected as non-UTF-8 through blob/general fetch. These were **format/capability errors, not an access denial**. Following the parent's clarification, GitHub contents metadata returned its exact official download_url. A normal HTTP GET returned 200 and 1,241,217 bytes; Git blob SHA exactly matched `1d0865ec75f2be0ef0252039797ab8510c392206`. The file was decoded, dimensions verified and pixels viewed before adding its existing bg runtime path. No further blocker or permission question remains for this asset.

## Checks actually performed

- Existing trusted TypeScript parser: **zero syntax errors** across copied TS sources.
- Static semantic TypeScript check using the parent's already-installed TypeScript plus actual Phaser/Vite declarations: **zero diagnostics**. No package was installed and no game code was executed. This is not a bundler/build or browser-play pass.
- Gameplay configuration initializer comparison: **no unexpected differences**; only LEVELUP_CARD and DAMAGE_NUMBER_CONFIG changed, with SKILL_FEEDBACK_MAP added.
- Relative source imports resolve; no merge markers; no SpriteLoader/earth/deleted sprite-pack references.
- Parent iframe entry/telemetry, Arrow Player, Boss/combatRules files retain exact snapshot hashes.
- The eight merged source diffs and seven original PNG Git blob hashes are recorded.

Still required after the parent copies/reviews: actual typecheck/build, UI screenshots with restored tower/illustrations, latest sound feedback and overlay/replay/exit regression play. Do not label this isolated preparation a browser-tested or naturally won game.
