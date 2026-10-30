# 梅花教室组合 visual model

One optional landmark, comprising five candidate Overture polygons. Original projected rings and source attribution are recorded in the metadata; no polygon is claimed to be a specific numbered classroom. The connector is invented model design, not a mapped feature. 4.5 m is an unverified photo-relative display estimate, not a survey or evidence of current conditions. The official photo is external reference only and is not distributed.

`MODEL_OUTPUT_DIR=/tmp/meihua-output blender --background --python scripts/landmarks/meihua/generator.py` generates the model, metadata and preview renders. Copy the model and metadata to `public/assets/campuses/huyu` and run `python scripts/landmarks/meihua/verify.py`. The verifier parses the distributed GLB, checks all source base vertices, connector, upward roof normals, self-contained buffers and display height. See `public/data/augmentation-huyu-audit.json` for preserved ML predictions and explicit visual overrides.
