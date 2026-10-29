# Round 04: readable landmarks, bounded usability refinement

2026-10-29 18:16 UTC. Read AGENTS, all three original plans, decisions/progress/current state and inspected actual desktop/mobile round03 screenshots before planning. Screenshots show tiny roof markers with no readable place names; this is independent of unresolved accurate-height evidence.

## Research before plan
- https://threejs.org/docs/pages/CSS2DRenderer.html and https://threejs.org/docs/pages/CSS2DObject.html read today. Official MIT Three addon, installed0.186.1. Supports scene-linked HTML labels, translation/2D rotation; documented100% browser/display zoom limitation. Reuse installed addon, no extra dependency or external assets.
- Inspect installed addon cleanup before integration. Scope is labels and regression only, not invented geometry/facades.

## Ownership / implementation
Parent integrates CampusScene.ts and style.css; tests/e2e/explore.spec.ts adds label count across campus switches and real CDP two-touch gesture suppression. No other writer. Existing Terra scene/travel implementation retained.
- Add pointer-transparent CSS2D layer with readable Chinese names and station numbers, attached above each known landmark.
- Label layer must resize, render, dispose and remove old-campus labels; no HTML injection, use textContent.
- Keep scene pointer picking through labels; show only3/4 known markers. Full real-proportion acceptance remains blocked on source evidence.

## Acceptance / rollback
Typecheck/lint/unit/build plus actual browser tests and desktop/mobile screenshots on exact commit. Check names visible, no duplicated labels on switch, no touch false pick. Roll back label integration only if overlay harms interaction. Do not treat this refinement as full aesthetic acceptance or publish public site.
