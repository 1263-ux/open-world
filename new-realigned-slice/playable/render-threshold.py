# Offline actual GLB integration, not a gameplay screenshot.
import bpy
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
for p in [D/'../receiving-space-v2/edge-fade/receiving-edge-fade.glb',D/'threshold-evidence/threshold.glb']:
 bpy.ops.import_scene.gltf(filepath=str(p.resolve()))
s=bpy.context.scene;cv=lambda p:Vector((p[0],-p[2],p[1]))
s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False
s.render.resolution_x=1000;s.render.resolution_y=700;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Soft pearl blue');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.27,.35,.42,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for name,pos,power,size,color in [('Sky',(0,9,-13),1500,12,(.75,.84,1)),('Warm receiving',(-3,4,-3),650,5,(1,.78,.52))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=cv(pos);o.rotation_euler=(cv((0,0,-13))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();s.camera=bpy.context.object;s.camera.data.lens=32
s.camera.location=cv((3.7,1.55,-7.4));s.camera.rotation_euler=(cv((2,.28,-16))-s.camera.location).to_track_quat('-Z','Y').to_euler()
s.view_settings.view_transform='AgX';s.render.filepath=str(D/'threshold-evidence/through-arch.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(D/'threshold-evidence/through-arch.blend'))
