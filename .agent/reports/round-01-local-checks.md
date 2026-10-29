# Round 01 checks

Date: 2026-10-29. Stage: initial technical prototype, NOT final campus reconstruction.

## Results

- `npm install`: passed after selecting TS6.0.3 compatible with typescript-eslint peer range. Lockfile committed; no forced dependency bypass.
- `npm run typecheck`: passed.
- `npm run lint`: passed. TypeScript handles undefined identifiers; ESLint no-undef disabled only for TS/Vue, not globally.
- `npm run test`: 20 tests passed; ordered quests, duplicate/out-of-order progress, completion/reset and corrupt/denied storage.
- `npm run build`: passed. JS ~668.47 kB (~179.68 kB gzip); CSS ~10.99 kB (~3.30 kB gzip). This is build output size, not measured load-time/FPS.
- Playwright 4 E2E tests written. Local browser install archive was invalid; installed system Chromium then failed before page creation because this host restricts browser socket setup. Approved elevation failed while setting up the runtime. No E2E behavior was observed locally; none is reported passed.
- CI runs type/lint/unit/build and installs Playwright Chromium on Ubuntu before E2E; screenshots/traces are retained as private workflow artifacts.

## API execution evidence

No key, auth file, raw request log or sensitive response metadata is included.

| Task | Actual API model | Input tokens | Output tokens (includes reasoning) | Status |
|---|---|---:|---:|---|
| Round plan | gpt-6.1-sol | 15960 | 750 | completed |
| Scene generation | gpt-6.1-terra | 2254 | 7070 | completed |
| UI/state generation | gpt-6.1-terra | 2386 | 9144 | completed |

These are API-reported usage, not dollar invoices or remaining balance. Input cache-write tokens were 15957 / 2251 / 2383 respectively; cached-read tokens 0. Reasoning output was 0 / 1243 / 650 respectively and is already included in output totals. No gpt-6.1-luna call occurred because it is absent from available model listing. Parent integration and tool checks must not be misreported as additional billed API calls.

## Remaining validation

Browser interaction, canvas picking, pointer-drag suppression, mobile layout, WebGL fallback, keyboard focus, screenshots and actual device performance. Building identity/layout are intentionally schematic pending sourced refinement.

## CI verification and visual review

- First run40891266985 for18c39aa passed20 unit +4 browser tests. Screenshots exposed portrait framing and content-order issues; fixed locally, plus runtime WebGL context-loss handling and Escape close.
- Final code run40892347891 for69334abb9dcb7d7f31933a2956d54bc8a858a59b passed typecheck/lint/unit20/build/browser5. Verified run success and downloaded artifact12905491506. Desktop/mobile screenshots visually inspected.
- Main was advanced to exactly that tested code commit. No public hosting deployed.
- An API fresh-code-review request was blocked pending explicit permission to send this private repository source to OpenAI API. No review response/usage artifact exists, so no successful review or invoice charge is claimed. Necessary sharing approval requested; no reroute to evade denial.
- Remaining: accurate geometry/maps, GLB pipeline, real-device performance and human visual baseline acceptance.
