# Source crops and attribution

These small public source crops support reproducible campus modeling. They are not current surveys or exact pedestrian navigation.

- Overture Maps2026-10-21.0, building source records: OpenStreetMap contributors and East Asian Buildings (Shi et al., DOI10.5281/zenodo.8174931). ODbL1.0. https://docs.overturemaps.org/attribution/ . Original source metadata retained in each feature. Cropped by campus-boundary representative point; filtering and local-coordinate conversion are this project's changes.
- Che et al.,3D-GloBFP, Zenodo v4 https://doi.org/10.5281/zenodo.15487006 and author Figshare partIX v4 https://doi.org/10.6084/m9.figshare.28904453.v4 . CC BY4.0 https://creativecommons.org/licenses/by/4.0/ . Heights are XGBoost estimates of2020 conditions, not surveyed dimensions. These crops/extracted attributes are project modifications, not author-verified campus models. Tile2281 checksum is recorded in manifest.json.
- Keep both attributions and applicable ODbL derived-database obligations when redistributing the combined derived database. This runtime data is supplied in public/data/campus-spatial.json with source crops and audit records available alongside it. See https://opendatacommons.org/licenses/odbl/1-0/ . No endorsement implied.

Known defects: incomplete/old footprints, roof-vs-ground offsets, tiny fragments and false detections; conflicting/low-overlap ML heights must not overwrite existing height/floor evidence. Every imported height has a status; fallback extrusion heights are display choices, not sourced measurements. Official campus photos are reference-only and are not included here.
