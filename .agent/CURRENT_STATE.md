# Current state

Updated 2026-10-29 18:11 UTC. This overrides old progress snapshots.

## User goal and authority

The first toy-diorama visual baseline was REJECTED. User requires a complete playable release, evidence-based real proportions, aesthetics and coherent gameplay. Before every new plan reread plans/current state and do bounded relevant source/reuse research. Main pushes after validation are authorized; user handles large outcome validation, not every edit. No public deployment or extra spending authorization.

Selective transmission to official OpenAI API is now explicitly permitted: only necessary snippets/interfaces/plans/errors for the current subtask. No whole repository, credentials/auth, or unrelated information. Source manifests are recorded per call. Old blocked wholesale review is not resumed.

## Active round03

- Read official photos/maps and OSM evidence before visual plan. Plan in plans/round-03-visual-rework.md.
- Genuine OSM geographic polygons for2 campus boundaries,15 buildings,27 parks/sports areas projected WGS84->local meters;1unit=1m. Complete polygon shapes preserved. Only partial campus coverage; NOT survey/BIM. Heights largely estimates/unverified, explicitly tagged.
- Offline preprocessing reuses Shapely and NetworkX A*. Game paths stay inside boundary and outside building buffers; they are NOT verified real walking routes. Yingxi south gate has a mapped node; Huyu north-gate geographic position and Meihua footprint remain unknown, not invented.
- Terra API independently generated new scene and full-viewport UI. Parent integrating/testing. Continuous avatar travel->arrival->observation->checkin->nextstop->completion/replay/exit replaces remote card clicking. No backend/multiplayer yet; still future roadmap.
- Local typecheck/lint/unit23/build passed for current integration before final browser validation. New browser tests updated for movement and observation. First dev CI stopped at JSON module discovery; fixed using import attribute. 24 unit tests plus test discovery now pass; browser rerun pending for895e7316a7b919f8dbe925bb8b18ad4ee92c1a60. Previous round01 CI must not be treated as evidence for newcode.
- Prior main checkpoint edb369c418fbd8a7a8b4472da88bf0c93eb4a20a remains working history. New rework will be checked on development branch before main.

## Budget/runtime

API cap$90; current account balance/invoice not readable here. Actual model/token usage retained, never substitute estimates for invoice. Initial pilot conservative reserve ceiling$5;no auto-recharge. gpt-6.1-terra implementation, gpt-6.1-sol planning/review;6.1luna absent, simple work staysTerra. Nested Codex CLI cannot initialize host sandbox, so direct Responses generation + parent sandbox tests; no sandbox weakening. GitHub connector publication and CI work;localCLI git auth absent.

## Remaining acceptance gaps

Final browser/visual review, source coverage, unknown heights and facades, Huyu entrance coordinates and Meihua footprint, actual device performance and complete user-facing delivery. Do not call the campus fully real-scale/complete when these are unresolved. No school images or Hks assets redistributed.

## Fresh review corrections in progress

- Fixed downward road winding with regression test, preserved active chapter stamps across campus switch, suppressed second-pointer false picking, changed Huyu entry camera to north side. Latest three fixes local, not yet in remote CI.
- Fresh review found first leg hidden behind main building and routes mostly crossing unarticulated ground. Terra targeted API patch is generating permanent explicitly designed game walkways, slower visible movement and route framing. No claim these paths are surveyed real routes.
- Public source research is checking whether missing height/gate/Meihua evidence can be resolved; if not, request exact required input instead of inventing dimensions.
