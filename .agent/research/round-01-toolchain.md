# Round 01: runtime and toolchain research

Date: 2026-10-29. Read original three plans and latest decisions before planning. Sol generated the round plan via Responses API; Terra generated independent scene and UI modules in parallel. Parent applied reviewed JSON file outputs and runs commands in the existing sandbox. No model-generated shell is auto-executed.

- npm registry metadata verified Vue 3.5.44, Vite 8.3.5, Three 0.186.1, Vitest 5.0.5, plugin-vue 6.0.10, Playwright 1.64.1.
- Latest TypeScript 7.0.2 was rejected by typescript-eslint 8.72.1 peer range >=4.8.4 <6.1.0. Use verified compatible TypeScript 6.0.3; no --force/legacy-peer-deps workaround.
- Reuse Three OrbitControls, Raycaster and original procedural meshes; no unlicensed map textures/Hks assets copied.
- Vite host is explicitly 127.0.0.1 because wildcard host network enumeration is unavailable in current container. This does not enable outside/public access.
- Playwright browser download was corrupt in this environment. Existing /usr/bin/chromium startup is blocked by local socket permissions before tests. Elevation also failed during runtime setup; do not weaken sandbox or change protected session paths. Run the checked-in browser tests on ordinary GitHub Actions runners, and distinguish CI results from local tests.
- References: https://threejs.org/docs/pages/OrbitControls.html ; https://threejs.org/docs/pages/Raycaster.html ; https://vite.dev/guide/ ; npm registry package metadata obtained with npm view.
