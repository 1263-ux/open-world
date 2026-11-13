import bpy
from pathlib import Path
from mathutils import Vector
D=Path(__file__).parent/'evidence'
for name in ['cloud','folded']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(D/(name+'.glb')));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=False;s.render.resolution_x=640;s.render.resolution_y=480;s.render.resolution_percentage=100
 s.world=bpy.data.worlds.new('Study');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.4,.5,.55,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.object.light_add(type='AREA',location=(3,2,8));l=bpy.context.object;l.data.energy=900;l.data.size=7
 bpy.ops.object.camera_add(location=(4,6,4));c=bpy.context.object;c.rotation_euler=(Vector((0,3.5,.7))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=5.5;s.camera=c;s.view_settings.view_transform='AgX';s.render.filepath=str(D/(name+'-source-close.png'));bpy.ops.render.render(write_still=True)
