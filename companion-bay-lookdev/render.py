import bpy,math
from pathlib import Path
from mathutils import Vector
D=Path(__file__).parent/'evidence'
for name in ['cloud','rain','folded']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(D/(name+'.glb')))
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=16;sc.cycles.use_denoising=False;sc.render.resolution_x=640;sc.render.resolution_y=480;sc.render.resolution_percentage=100
 sc.world=bpy.data.worlds.new('Research ambient');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.43,.49,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 for loc,power,size in [((2,-6,12),1700,9),((-8,3,8),1000,10)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(13,-16,14));cam=bpy.context.object;target=Vector((0,0,.1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=25;sc.camera=cam
 sc.view_settings.view_transform='AgX';sc.render.filepath=str(D/(name+'-offline.png'));bpy.ops.render.render(write_still=True)
 # Close relational view to inspect the actual reused fish, not an enlarged fake fish.
 if name=='cloud':
  cam.location=(6.6,-2.3,2.1);target=Vector((5.35,-.5,.52));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.8;sc.render.filepath=str(D/'fish-close-offline.png');bpy.ops.render.render(write_still=True)
