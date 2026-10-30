"""Stdlib verification of gate identity, display-only facts and GLB header/bounds.

The central-passage ray clearance was checked in Blender 4.3.2 by verify.py. This
portable check pins that proof to the exact checked GLB hash; it does not rerun it.
"""
import hashlib, json, struct
from pathlib import Path
D = Path(__file__).resolve().parents[3] / 'public/assets/campuses/huyu'
blob = (D / 'north-gate.glb').read_bytes()
meta = json.loads((D / 'north-gate.metadata.json').read_text())
expected = '9bd6e65f9ef3cc98f13d0300df492fa164d65881bb74a99c5a891a6c38f625af'
assert hashlib.sha256(blob).hexdigest() == expected == meta['artifact']['sha256']
assert len(blob) == 80820 == meta['artifact']['bytes']
assert struct.unpack_from('<4sII', blob) == (b'glTF', 2, len(blob))
length, kind = struct.unpack_from('<II', blob, 12)
assert kind == 0x4e4f534a
gltf = json.loads(blob[20:20+length])
assert not gltf.get('images') and all('uri' not in b for b in gltf['buffers'])
assert all(v is None for v in meta['facts'].values())
assert meta['displayDesign']['dimensionsMeters'] == {'span':32, 'maxHeight':9, 'depth':2}
assert meta['displayDesign']['renderingAnchorWorldXZ'] == [14,-200]
assert 'not measured' in meta['displayDesign']['dimensionsStatus']
assert 'not a mapped gate' in meta['displayDesign']['anchorStatus']
arch = next(n for n in gltf['nodes'] if n.get('name') == 'Continuous shallow arch')
assert not any(k in arch for k in ('translation','rotation','scale','matrix'))
primitive = gltf['meshes'][arch['mesh']]['primitives'][0]
a = gltf['accessors'][primitive['attributes']['POSITION']]
assert abs(a['min'][0]+16)<.01 and abs(a['max'][0]-16)<.01 and abs(a['max'][1]-9)<.01 and abs(a['min'][2]+.7)<.01
print('PASS: gate GLB hash/header, self-contained arch display bounds, and null real-world facts; prior Blender ray-clearance proof pinned to exact hash (not rerun).')
