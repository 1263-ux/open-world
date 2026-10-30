# Minimal direct-port preparation — 2026-10-30 UTC

Base: user-authored `ShanEior/Hks@843ecbbae414a403eae350f4f8105cfbb84acf72` (2026-05-30 07:53:46 UTC). User ownership/direct-port authorization is complete. The title, classes, art generators, eight original skills, waves, damage/XP numbers, 300-second victory and Boss rules are retained. No replacement game was written.

## Files and rationale

1. **src/ArtGen.ts** — Select the file's existing original procedural `genBackground`, remove its now-dead raster-compositing adapter, and guard repeated creation of global `px_white` texture so replay does not dereference a null canvas. All original character, monster, building, Boss and UI generators remain.
2. **src/GameScene.ts** — Remove deleted-asset requests and unused external-environment method/import. Add complete per-run initialization and SHUTDOWN/DESTROY cleanup, with a named removable Boss earthquake listener. Center the existing procedural building at the original config center, remove large-PNG-only scale 0.45, use a low base collider inside monster attack radius, and pass the actual building coordinates to player/monsters/Boss/minions. Protect level-up pause from a late first-encounter popup.
3. **src/Player.ts** — Register arrow keys as promised by the existing tutorial; same movement calculations, speed and WASD controls.
4. **src/SoundManager.ts** — Add `activate()` and `dispose()`. Track every native timeout, invalidate older run generations, cancel queued sounds and voice-release callbacks, disconnect the compressor, close/reset AudioContext and clear static pools/dedup state. Core tone/noise/skill/Boss audio designs stay original. Ignore expected AudioContext resume rejection instead of leaking an unhandled promise.
5. **src/HUD.ts** — Add `dispose()` and generation-scoped, cancellable monster/skill popup timers. A manual close cannot later dismiss another popup or unpause a level-up panel. Make a skill choice idempotent. When no external illustration exists, display the game's own generated monster texture rather than a blank illustration region.
6. **src/VFX.ts** — Add `reset()` for static trauma/Scene references at run start/teardown. Original effects remain intact.
7. **src/SpriteLoader.ts** — Removed only from the modified source set because its entire removed external sprite pack is obsolete; preserved unmodified under `.original/`.

## Exact originals and diffs

- `SOURCE_INVENTORY.json` is **unchanged** and continues to describe the exact remote source hashes, not the patched copies.
- `.original/` contains all 21 exact text source/configuration originals; Git blob hashes were checked again after modifications, with zero mismatches.
- `PORT_CHANGES.patch` is the unified diff against those originals.
- `PATCHED_INVENTORY.json` records changed/deleted files and patched SHA256 separately.
- All gameplay configuration in `src/config.ts` is byte-identical to the pinned original. Package/configuration/index/main files are unchanged.

## Parent integration hooks

- Keep original `MenuScene`, `TutorialScene`, `GameScene` and dimensions in a lazy-loaded Phaser factory.
- **Do not import original main.ts into the campus bundle:** it auto-constructs a game and registers a global rejection handler. Parent should adapt that small entry to `createHksGame(container)` and retain the resulting Phaser.Game instance.
- `GameScene` now activates and disposes run audio automatically when its Scene starts/stops. The outer factory should additionally call exported `SoundManager.dispose()` and `VFX.reset()` before `game.destroy(true, false)` on any exit/error, including menu/tutorial exits; wait for Phaser DESTROY before immediate re-entry.
- Scope keyboard events to the focusable game mount; restore focus/campus state on exit. A DOM return-to-campus control should remain available throughout.
- Only copy the needed `src/*.ts` implementation files; do not accidentally ship `.original/`, reference index.html/global CSS, old package tooling or scratch reports.

## Verification boundary

Performed **static file checks only**: exact original Git hashes, fixed relative imports resolving to files, no remaining runtime SpriteLoader/asset preload calls, unchanged gameplay config, diff inspection and file inventories. No npm install, TypeScript execution, game launch, browser interaction, CI trigger, campus repository edit, commit, push or deployment was performed. Parent must run typecheck/build and actual browser play against the integrated result.

Still deliberately unchanged: original development cheat key handler Q/SPACE/R (parent should gate it for production), original manual-pause limitations and larger gameplay-balancing decisions. Do not present these static repairs as a natural-play win or tested performance result.

## Campus embedding changes

The entry page runs in a lazy same-origin iframe, not in the Vue/Three bundle. The small main entry is adapted to createHksGame, with ready/error/Escape notifications, pagehide disposal and read-only runtime snapshots for real-input QA. Original debug shortcut registration is gated behind Vite DEV; the shipped nested game is built in production mode. Vite output is public/games/hks and generated assets are not committed. Dependency versions remain pinned by the original lock; tarball host was normalized to the official npm registry. Original page CSS stays within its own iframe.

- Boss normal melee now uses its already-computed buildingRange as intended by the existing movement comment, alongside unchanged cooldown. The separately presented global earthquake skill remains global. Pure regression tests distinguish out-of-range, cooling-down and in-range attacks; natural Boss victory has not yet been tested.

## Real-browser feedback and latest source

The first real browser run reached combat, natural defeat, menu replay and Escape return; one assertion incorrectly compared innerText with textContent and was corrected, not an app state-loss fix. Mobile screenshot exposed duplicate centering (CSS flex plus Phaser autoCenter); the container is now block layout. Portrait-only viewport600x960 improves readability while world1920x1080 and combat values stay unchanged. Root QA now uses actual CDP touch input and logical viewport dimensions.

Latest six-file upstream feedback/readability improvements and seven existing project PNGs from3cb39bc8 were subsequently merged; see MODERNIZATION.md and ASSET_INVENTORY.json. All imported PNG bytes are original. Latest visual version still requires fresh browser checks.
