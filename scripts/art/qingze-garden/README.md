# Qingze reading garden: local authoring and checks

This is original, estimated game scenery, not a reconstruction of the actual sculpture or surveyed garden. No source photographs or textures are embedded. See `docs/resources/qingze-garden-model.md` for provenance and spatial/integration constraints.

Blender 4.3.2, from repository root:

```sh
MODEL_OUTPUT_DIR=/tmp/qingze-output blender --background --python scripts/art/qingze-garden/generator.py
python scripts/art/qingze-garden/verify.py /tmp/qingze-output
node scripts/art/qingze-garden/check-loader.mjs /tmp/qingze-output/qingze-original-setting.glb
python scripts/art/qingze-garden/compare_geometry.py public/assets/campuses/yingxi/qingze-reading-garden.glb /tmp/qingze-output/qingze-original-setting.glb
```

The comparison requires the approved asset to have been promoted to the path above. It checks identical material definitions and oriented per-material triangle positions/normals to 1e-5 tolerance, ignoring ordering. Blender export **does not reproduce the same byte hash** between runs because index ordering differs; this comparison does not replace the SHA-256 check on the actual distributed file.

The generator is preview-free by default and writes outside the repo. Optionally set `PREVIEW_RENDER=1`; to include the separately sourced CC0 Hoodie as a **preview-only** 1.75 m person, also set `QINGZE_CHARACTER_GLB=/absolute/path/to/Casual_Hoodie.glb`. Character, lights and floor are created only after selection-only GLB export. Previews approximate the game's sun direction and warm tint, but Blender AgX/world lighting differ from Three.js rendering.

The approved GLB metadata can be reproduced from that exact GLB:

```sh
python scripts/art/qingze-garden/make_metadata.py public/assets/campuses/yingxi/qingze-reading-garden.glb /tmp/qingze-reading-garden.metadata.json
python scripts/art/qingze-garden/verify.py public/assets/campuses/yingxi
```

Metadata generation intentionally refuses a different SHA, because collision and semantic vertices are tied to the specifically reviewed asset. A new visual revision requires new review and metadata, not a changed hash hidden behind the old identity.
