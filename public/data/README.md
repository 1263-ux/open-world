# OpenStreetMap-derived campus database

© OpenStreetMap contributors. Database licensed under Open Database License (ODbL)1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Attribution: https://www.openstreetmap.org/copyright .

osm-source.geojson contains the selected source polygons. campus-spatial.json contains the derived local-meter database and original GAME route overlays. Reproduction script: scripts/build_spatial_data.py; source query and timestamp are in .agent/research/inputs/ and round-03-scale-evidence.md. Geographic metadata is approximate community mapping, not survey/BIM. Height tags remain unverified; levels-based/default heights are explicitly labeled estimates. Game stops/routes are not real entrance positions or walking directions. Dataset redistribution remains under ODbL; application code is a separate work. No map tiles or school photo textures are redistributed.

## Dense source-backed update (2026-10-30)

Overture Maps2026-10-21.0 supplements the original OSM named features. After minimum20m² and overlap filtering,94Huyu+129Yingxi building polygons are used (candidatefeatures, not a verified current survey).207 heights use high-IoU2020MLpredictions from Che et al.,3D-GloBFP,CC BY4.0;8 remain explicit displayfallbacks,7 are floor-derived and1OSM-tagged. No MLvalue overwrites an existingOSMheight/floor.

See sources/README.md, sources/manifest.json, originalsourcecrops, and augmentation-*-audit.json for license,provenance,matchingthresholds,rejections andchanges. The combined OSM/Overture derived database retains ODbL obligations plus GloBFPauthor attribution. Do not call modelprediction measuredheight.
