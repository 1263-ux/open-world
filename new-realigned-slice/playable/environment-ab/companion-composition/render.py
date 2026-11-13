import bpy,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(D.parent/'seated-context.blend'));s=bpy.context.scene
# Entire supported bowl assembly, including children fish, remains rigid. No enlargement.
names=['Mesh_40','Mesh_44','Mesh_45','Mesh_46','Mesh_47','Mesh_48','Mesh_49','Mesh_56','Mesh_57','Mesh_58']
for name in names:
 o=bpy.data.objects[name];o.location+=Vector((-.08,-1.28,0))
# Resting gaze toward the courier, a proposed behavior cue rather than enlarging fish.
bpy.data.objects['Mesh_41'].rotation_mode='XYZ'
bpy.data.objects['Mesh_41'].rotation_euler=(0,0,math.pi/2)
bpy.context.view_layer.update()
# Same seated player and near-side viewing direction. Target between both companions.
cv=lambda p:Vector((p[0],-p[2],p[1]))
s.camera.location=cv((3.55,1.62,-9.6));target=(2.32,.78,-13.3)
s.camera.rotation_euler=(cv(target)-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=38
# Geometry intersection evidence at unchanged seated pose. Surface test, not full containment proof.
dg=bpy.context.evaluated_depsgraph_get()
def bvh(o):
 e=o.evaluated_get(dg);m=e.to_mesh();vs=[e.matrix_world@v.co for v in m.vertices];ps=[tuple(p.vertices) for p in m.polygons];tree=BVHTree.FromPolygons(vs,ps);e.to_mesh_clear();return tree
assembly=[bpy.data.objects[n] for n in names];bounds=[]
for o in assembly:
 vs=[o.matrix_world@v.co for v in o.data.vertices];bounds.append({'name':o.name,'min':list(map(min,zip(*vs))),'max':list(map(max,zip(*vs)))})
actor=bpy.data.objects['Actual_B2_seated_contract'];amesh=[o for o in actor.children_recursive if o.type=='MESH' and not o.hide_render and o.visible_get()];hull=[o for o in bpy.data.objects['Node_33'].children if o.type=='MESH' and o.name not in names and o.name!='Mesh_59']
contacts=[]
for a in assembly:
 ta=bvh(a)
 for b in amesh+hull:
  hits=ta.overlap(bvh(b))
  if hits:contacts.append({'assembly':a.name,'other':b.name,'triangles':len(hits)})
(D/'geometry-review.json').write_text(json.dumps({'bowlLocalCenter':[.27,.46,.78],'deltaThree':[-.08,0,1.28],'cameraThree':[3.55,1.62,-9.6],'targetThree':target,'assemblyBoundsBlender':bounds,'surfaceIntersections':contacts,'scope':'Single seated pose; not boarding animation or containment guarantee'},indent=2))
s.cycles.samples=48;s.render.filepath=str(D/'E2-forward-companion.png');bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=str(D/'candidate.blend'))
