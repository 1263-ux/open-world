# Asset and dependency sources

Date: 2026-10-29. This prototype uses original procedural geometry and CSS, with no copied external photos, maps, textures or Hks assets.

| Item | Source | Permission / treatment |
|---|---|---|
| Campus names and indicative landmark relationships | https://www.tyut.edu.cn/xxgk1/xydl.htm | Facts/reference only; school images not redistributed. See round-00 research for uncertainty and source dates. |
| Three.js + OrbitControls | https://github.com/mrdoob/three.js | MIT package; retain distribution license. No full example app copied. |
| Vue | https://github.com/vuejs/core | MIT package; retain distribution license. |
| Procedural building/tree/road geometry, UI and quest code | Generated for this project and integrated/reviewed here | Original schematic assets, not a claim of exact architectural reproduction. |
| Hks | https://github.com/ShanEior/Hks | Not included: no verified license for current code/assets. |

Building coordinates are local illustrative coordinates, not geographical survey data. No recognizable people, access-control or security-system details are collected.

## Round 03 geographic data

OpenStreetMap-derived polygons and clipped road centerlines: © OpenStreetMap contributors, ODbL1.0, https://www.openstreetmap.org/copyright . Runtime derived data is supplied in public/data/ with its source snapshot and license notice. No OSM tiles are used. The exact footprint polygons are preserved, projected into WGS84 local meter coordinates. Community height tags and floor-based height estimates are explicitly marked; not a survey or verified current facade.

Offline geometry validation/cropping reuses Shapely, and route generation reuses NetworkX A*. Derived game routes are not real walking/navigation directions and avoid building footprints in the game model. No unverified new buildings are generated to fill coverage gaps.
