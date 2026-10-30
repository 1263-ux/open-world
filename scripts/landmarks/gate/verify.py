"""Run blender -b -t 2 --python verify.py. Checks exported artifact, not source."""
import bpy, math, os
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[3] / 'public/assets/campuses/huyu')
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('north-gate.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert meshes, 'No mesh in GLB'
points=[o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
mins=[min(p[i] for p in points) for i in range(3)]; maxs=[max(p[i] for p in points) for i in range(3)]
tri=sum(len(o.data.loop_triangles) for o in meshes for _ in [o.data.calc_loop_triangles()])
print('Imported Blender bounds:',mins,maxs,'triangles:',tri,'bytes:',os.path.getsize('north-gate.glb'))
assert abs(mins[0]+16)<0.15 and abs(maxs[0]-16)<0.15, 'width is not 32m'
assert abs(mins[2])<0.15 and abs(maxs[2]-9)<0.15, 'height is not 9m'
assert maxs[1]-mins[1]<=2.01, 'depth exceeds 2m'
assert tri < 10000 and os.path.getsize('north-gate.glb') < 500000
# Ray casts through the open middle at four heights, both front to back and reverse.
for x in [-4,0,4]:
 for z in [0.5, 2.0, 3.5]:
  for start,direction in [(Vector((x,10,z)),Vector((0,-1,0))),(Vector((x,-10,z)),Vector((0,1,0)))]:
   hit=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),start,direction,distance=20)[0]
   assert not hit, f'passage blocked at {x}, {z}'
print('PASS: front/back central clearance, display bounds and size; Blender X,Y,Z correspond to glTF X,-Z,Y.')

# Inspect raw GLB accessors: the arch is identity-transformed; Z is depth, Y vertical.
import json, struct
blob=open('north-gate.glb','rb').read()
length, kind=struct.unpack_from('<II', blob, 12)
assert kind == 0x4e4f534a
gltf=json.loads(blob[20:20+length])
arch=next(n for n in gltf['nodes'] if n.get('name')=='Continuous shallow arch')
assert not any(k in arch for k in ('translation','rotation','scale','matrix'))
primitive=gltf['meshes'][arch['mesh']]['primitives'][0]
a=gltf['accessors'][primitive['attributes']['POSITION']]
assert abs(a['min'][0]+16)<0.01 and abs(a['max'][0]-16)<0.01
assert abs(a['max'][1]-9)<0.01 and abs(a['min'][2]+0.7)<0.01
print('PASS: raw glTF arch X span, Y height, front at negative Z.')
