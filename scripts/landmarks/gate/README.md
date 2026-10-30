# 虎峪北门 visual study

This is original geometry inspired by a publicly visible 2020 official photograph, not a mapped or surveyed gate. The [14, -200] render anchor is approximate and inferred. Its 32 × 2 × 9 m display envelope and collision polygons are invented, not real-world measurements. The photo is not included. Metadata records null real coordinates, endpoints and dimensions.

The lettering is converted from Noto Sans CJK Bold, under SIL Open Font License 1.1; the font file is not embedded. Preserve `public/assets/campuses/huyu/NOTO-CJK-COPYRIGHT.txt` and the [upstream license](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE). The generator requires a suitable CJK font; its fallbacks do not guarantee byte-identical output. Run `MODEL_OUTPUT_DIR=/tmp/gate-output blender --background --python scripts/landmarks/gate/generator.py` and copy the resulting `model.glb` as `north-gate.glb` only after inspecting it.

`python scripts/landmarks/gate/verify_portable.py` checks GLB identity/header, display bounds and null facts. Blender 4.3.2 authoring verification (`blender -b -t 2 --python scripts/landmarks/gate/verify.py`) additionally checked the central passage using bidirectional rays; that proof applies only to the pinned SHA-256 in the portable check, which does not rerun Blender.
