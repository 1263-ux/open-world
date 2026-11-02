# Campus nature subset

CC0 assets by **Kay Lousberg**, from the official KayKit Forest Nature Pack FREE.
See `License.txt` (verbatim) and `PROVENANCE.json` (official source URLs, original
archive/source-file SHA-256, original geometry bounds and derived GLB SHA-256).
Only five selected models and their shared atlas are shipped; not the full pack.

`campus-nature.glb` is 161,688 bytes, with five original meshes, one opaque
MeshStandard-compatible material and one original 1024×1024 PNG atlas. Vertex,
index, UV and normal bytes are unchanged. Packing concatenated source buffers at
4-byte boundaries, remapped accessor/buffer-view offsets and node names, embedded
the original PNG in a buffer view, and removed duplicate material references.
No mesh/image simplification, coordinate changes or artistic transforms were made.

| Runtime kind | Original model | Visible triangles |
|---|---|---:|
| tree-round | Tree_1_B_Color1 | 636 |
| tree-tall | Tree_1_C_Color1 | 1364 |
| tree-spreading | Tree_3_B_Color1 | 988 |
| shrub | Bush_3_C_Color1 | 272 |
| grass | Grass_1_B_Color1 | 132 |

The author root **Y=0** is ground level; roots extend below it. Do not raise the
model by its negative minimum Y. Place using actual transformed bounds, not a
thin-cylinder trunk assumption: these trees branch low. Triangle clipping against
world Y=0..1.8 at scale 1 gives maximum horizontal radius 2.114 m (tree-round),
2.948 m (tree-tall), 2.330 m (tree-spreading). They are not drop-in replacements
for narrow pedestrian-route trees with a 0.3 m trunk envelope.

Runtime collision copies split connected components, close original open wood
end-rings only, and keep each closed crown separate. They do not join empty space
between branches into solid walls. Visual source triangles are never changed.
Low grass is soft decoration. All visible meshes remain in normal photo/picking
occlusion; none are globally marked photoIgnore.

A library owns the shared geometries/material/atlas; batches borrow them and own
only their instance GPU data and object groups. Dispose batches before/alongside
the library; library disposal waits for live batches. Scene owners must guard
asynchronous attachment with their campus generation and surface load failures
explicitly while retaining base scenery. The atlas uses about 5.333 MiB RGBA with
mipmaps, shared once per library; no CDN or additional animation loop is used.
