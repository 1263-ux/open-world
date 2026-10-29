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
