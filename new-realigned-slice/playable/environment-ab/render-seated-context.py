# Same real B2 seat/root/camera contract as exploratory runtime. Offline only.
import bpy,math
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent;P=D.parents[2]
bpy.ops.wm.open_mainfile(filepath=str(D/'environment-comparison.blend'));s=bpy.context.scene;s.render.fps=30
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(P/'character-lookdev/b2/courier-b2-candidate.glb'));objs=set(bpy.data.objects)-before;roots=[o for o in objs if o.parent not in objs];rig=next(o for o in objs if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
rig.animation_data.action=next(a for a in bpy.data.actions if 'Sitting_Rig' in a.name)
bpy.ops.object.empty_add();actor=bpy.context.object;actor.name='Actual_B2_seated_contract';actor.scale=(.78,)*3;actor.rotation_euler.z=math.pi/2;actor.location=(2,13.1,.04065)
for o in roots:o.parent=actor
s.frame_set(0);bpy.context.view_layer.update();cv=lambda p:Vector((p[0],-p[2],p[1]));yaw=.35;zoom=4.1
s.camera.location=cv((2+math.sin(yaw)*zoom,1.8,-13.1+math.cos(yaw)*zoom));s.camera.rotation_euler=(cv((2,1,-13.1))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=36/(2*math.tan(math.radians(48)/2)*(1000/700))
s.render.filepath=str(D/'D-real-seated-context.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(D/'seated-context.blend'))
