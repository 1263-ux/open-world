# Original paper-plane station · provenance

- Asset: courtyard folding/launch furniture; **original game exhibition design, not a real campus facility**.
- Main modeling author: actual OpenAI API `gpt-6-astra` response, 2026-10-31 13:57:58 UTC; this is not a renamed native agent.
- Source: request-specific original procedural generator, retained by the owner in `asset-candidates/astra-paperplane-station/astra-original.py`. No downloaded external meshes, photos, textures, logos, or third-party artwork.
- Export adaptation: one Blender `tessellate_polygon` return-type compatibility fix, preserved separately as `integration-fix.patch`; original author response unchanged.
- Imported unchanged 2026-10-31 from accepted isolated candidate: `public/assets/exhibits/paperplane-station.glb` and `.metadata.json`.
- GLB SHA-256: `e2e5269d8e205fd0484b4ff9f891e6431087f5523c667e20c57d2d7ee5dde4a9`.
- Metadata SHA-256: `a974295472641ebac24783fbe35bae8b327647a8d40cd687fb768078ff3422ce`.
- Provenance/use: generated original project asset for this user request; no external asset license or attribution requirements were introduced. This statement does not grant a new blanket license to other project assets.
- Coordinate mapping: Blender `[x,y,z]` → glTF `[x,z,-y]`, metres, +Y up. Front/launch +Z; standing visitor faces -Z toward folding surface. Anchors are metadata entries, **not GLB nodes**.
- Host placement: `(65,.12,179)`, no rotation; standing `(65,.12,179.98)` and release `(65,1.42,179.85)` are transformed metadata positions. Ground-adjacent to original viewing platform, not on its raised deck. Canonical values/proxies live in `src/scene/OriginalViewingPlatform.ts`.
- Accepted offline geometry/budget/render evidence is in isolated candidate `VALIDATION.md` and validation JSON. Import does not establish game interaction, full route clearance, runtime loading, gameplay success or device performance; those require integrated acceptance.
- No API calls, key reads, or additional inference expenditure were made for this copy/graybox implementation.
