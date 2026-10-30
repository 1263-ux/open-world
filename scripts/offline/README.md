# Single-file offline candidate

## Round plan, 2026-10-30
Goal: adapt the proven isolated Vite IIFE prototype to the current three-model registry and produce a file:// candidate with explicitly included provenance, data, notices and no credentials. Non-goals: rewriting gameplay, deploying, modifying parent-owned iframe/entry or workflow. Owner: `scripts/offline/*`, `tests/e2e/offline-file.spec.ts` and the dedicated offline Playwright config only. Sequence: snapshot approved inputs into an external work directory; inline and verify assets; package an allowlist; run static, normal quality and real Chromium file:// checks. Vite library-mode documentation (https://vite.dev/guide/build.html#library-mode, read 2026-10-30) supports single IIFE builds; Three LoadingManager (https://threejs.org/docs/pages/LoadingManager.html#setURLModifier, read same date) documents Data URI asset resolution. We inline explicit registry URLs rather than add a global URL interceptor. Main risk: `file://` origin, srcdoc, WebGL and browser differences cannot be established by static checks. Roll back by removing these scripts/tests; standard HTTP application is unchanged.

## Build and test

Use an **immutable/frozen source tree** with existing root and Hks dependencies installed from the lockfiles. Output must be outside the source tree, in an empty directory or one initialized by this builder. From the repository root:

```sh
bash scripts/offline/package.sh "$PWD" "${RUNNER_TEMP:-/tmp}/campus-offline-work"
OFFLINE_HTML="${RUNNER_TEMP:-/tmp}/campus-offline-work/package/index.html" \
  npx playwright test --config scripts/offline/playwright.config.ts
```

The package is `campus-offline.zip` inside the work directory. No server or Node is required by the recipient. This is a candidate until real file:// Chromium tests pass; normal HTTP tests remain separately required. The source tree must not mutate during snapshot. The build fails closed for unknown model URL forms, unreferenced/new GLBs, image changes, source asset paths or direct network APIs, missing notices and unexpected HTML resource tags. Adapt and review the allowlist for intentional changes rather than disabling checks. The user-facing source links may navigate to websites on explicit click; no runtime asset requires them.

The scripts copy only named source/data/provenance paths, never workspace auth, .env, or node_modules into output. Symlinked dependencies are only read; Vite cache and output stay in the external work directory. `source-fingerprints.json` records SHA-256 hashes of the pre-adapter inputs, while `SHA256SUMS` covers the packaged files. The GLB checker requires binary files with no external buffer/image URIs, and package checks verify all registered models appear in the bundle. Include the Noto CJK notice even though its glyphs are baked into a model texture.

`offline-file.spec.ts` is a focused file:// smoke test, not a substitute for the long natural-combat, complete-quest, mobile-touch, model-failure and normal-HTTP regression tests. No browser sandbox/security flags should be weakened to run it.
