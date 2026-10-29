# Round03 in progress

Date2026-10-29. Source research and visual plan preceded implementation.

- Input-source scope: only sharedcontracts for scene/UI generation; reused quest/storage export signatures forUI; no entire repo/auth supplied. Later review uses only travel and arrival functions. See api-input-manifest.jsonl.
- Terra API scene response:1322input/12206output tokens;UI response1422input/11169output. Completed. No invoice amount claimed.
- Shapely + NetworkX preprocessing validates all routes against buffered footprint obstacles and campusboundary. Runtime dataset is in public/data with ODbL/sourceattribution. This is not proof of reality's current route access.
- Local typecheck/lint/unit23/build passed before final browser run. Browser CI for newcode pending.
- New visual has not yet been accepted. Main still prior baseline until checks. True whole-campus coverage and real verticaldimensions remain incomplete.

- Targeted Sol API review completed (1451 input/415 output): rejected unvalidated route endpoint extensions and tightened start equality. Corrected locally; no silent straight-line connectors through buildings. Reset/campus switch behavior remains covered by browser regression, not falsely claimed reviewed from omitted snippets.

## 18:23 UTC browser feedback
-895e7316 CI40928066823:24unit +5browser passed; inspected actual screenshots. Visuals still sparse and generic, not final aesthetic acceptance.
-75eea264 CI40928563232:4browser passed, desktop timed out at final route84%,2/3 stamps. Trace proves progress, not an absent route. The0.1second frame clamp made low-FPS software-rendered journeys run slower than wall time. Corrected to bounded1second elapsed frames plus visibility-change clock reset; static campus shadow map now updates only at campus rebuild. Moving pawn no longer casts stale cached shadow.
-caf06286 adds official CSS2D labels and real CDP two-touch regression; its CI still pending. Latest performance correction pending new exact-commit CI. Main not advanced; real dimensions/facades remain blocked on source evidence.
