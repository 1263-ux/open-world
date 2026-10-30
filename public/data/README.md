# OpenStreetMap-derived campus database

© OpenStreetMap contributors. Database licensed under Open Database License (ODbL)1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Attribution: https://www.openstreetmap.org/copyright .

osm-source.geojson contains the selected source polygons. campus-spatial.json contains the derived local-meter database and original GAME route overlays. Reproduction script: scripts/build_spatial_data.py; source query and timestamp are in .agent/research/inputs/ and round-03-scale-evidence.md. Geographic metadata is approximate community mapping, not survey/BIM. Height tags remain unverified; levels-based/default heights are explicitly labeled estimates. Game stops/routes are not real entrance positions or walking directions. Dataset redistribution remains under ODbL; application code is a separate work. No map tiles or school photo textures are redistributed.

## Dense source-backed update (2026-10-30)

Overture Maps2026-10-21.0 supplements the original OSM named features. After minimum20m² and overlap filtering,94Huyu+129Yingxi building polygons are used (candidatefeatures, not a verified current survey).202 heights use high-IoU 2020 ML predictions from Che et al., 3D-GloBFP, CC BY 4.0; 13 are explicit unverified display estimates, 7 are floor-derived and 1 is OSM-tagged. The five Meihua candidate footprints retain their original arrays and ML matches in the audit, but their final display heights are overridden to 4.5 m based on an old official photo. This is not a survey or proof of the current exterior. No MLvalue overwrites an existingOSMheight/floor.

See sources/README.md, sources/manifest.json, originalsourcecrops, and augmentation-*-audit.json for license,provenance,matchingthresholds,rejections andchanges. The combined OSM/Overture derived database retains ODbL obligations plus GloBFPauthor attribution. Do not call modelprediction measuredheight.

## Optional visual landmarks and route design

The Meihua group is one optional landmark, not five individually identified classrooms. The connector polygon is model design only; it is not an Overture or surveyed building footprint. The north gate is a visual study at an approximate inferred render anchor, not a mapped location, entrance or navigation point; its 32 × 2 × 9 m envelope is invented for display. Its collision-design polygons and the Meihua connector are stored separately as `modelObstacles`, never added to building counts. The game route generator subtracts these obstacles as well as source buildings, with 3 m buffers. All arrival coordinates are game-grid points, not real entrances.

See `augmentation-huyu-audit.json` `visualOverrides` for all five original prediction records and the display override reason. Raw source crops remain unchanged. See `public/assets/campuses/huyu/` metadata for source, confidence and asset provenance. No official photographs are redistributed.
