# 林荫一隅 / Campus style sample

A small, original, illustrative 3D environment for aesthetic review. It is not a reconstruction or a playable production campus. One unit is treated as approximately one metre; architectural and landscape details are design inventions, not verified campus facts.

## Run

Requires Node.js and npm. `npm install` then `npm run dev`, or `npm run build` and serve `dist/`. In this workspace the `node_modules` symlink reuses the existing original project's dependencies; it is not needed when installed normally. Drag to orbit; wheel/pinch to zoom. The two buttons switch between overview and pedestrian-height views. On a touchscreen use one finger to orbit and two to zoom. This is a scene inspection sample, not third-person gameplay.

## Sources and provenance

All geometry, colors, and code in this sample are newly authored. No screenshots or third-party models are included. Visual inspiration only: Tiny Glade's cohesive foliage, warm sunlight and architectural material detail, not its assets, layout or medieval setting. Three.js 0.186.1 (MIT) and Vite 8.3.5 (MIT) are the same versions used by the existing project. On 2026-10-31 the official [OrbitControls documentation](https://threejs.org/docs/pages/OrbitControls.html) was consulted for mouse/touch interaction, and [WebGLRenderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html) for rendering and color behavior. Their current live documentation may differ from the installed version.

## Limits

The scene is a style proposal, not an accurate or complete campus. Browser interaction, WebGL rendering and performance are not yet verified in this execution environment; a real runtime screenshot and human visual approval remain necessary. No existing production files or deployment have been changed.
