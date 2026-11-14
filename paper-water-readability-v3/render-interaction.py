import bpy,math
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent
for name in ['raised','flowing']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(D/('interaction-'+name+'.glb')))
 s=bpy.context.scene;s.render.fps=30
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(D.parent/'character-lookdev/b2/courier-b2-candidate.glb'));objs=set(bpy.data.objects)-before;roots=[o for o in objs if o.parent not in objs];rig=next(o for o in objs if o.type=='ARMATURE')
 for t in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(t)
 rig.animation_data.action=next(a for a in bpy.data.actions if 'Sitting_Rig' in a.name)
 bpy.ops.object.empty_add();actor=bpy.context.object;actor.name='Real_B2_at_right_pull_tab';actor.scale=(.78,)*3;actor.rotation_euler.z=-math.pi/2;actor.location=(4.9,22.45,.04065)
 for o in roots:o.parent=actor
 s.frame_set(0)
 s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.resolution_x=1000;s.render.resolution_y=700;s.render.resolution_percentage=100
 s.world=bpy.data.worlds.new('Quiet blue');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.43,.48,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 for loc,power,col in [((0,18,10),1300,(.8,.9,1)),((8,22,6),700,(1,.85,.72))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=9;o.data.color=col;o.rotation_euler=(Vector((2,21,.4))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(9,25.5,2.5));s.camera=bpy.context.object;s.camera.data.lens=36/(2*math.tan(math.radians(48)/2)*(1000/700));s.camera.rotation_euler=(Vector((3.1,22.5,.7))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.view_settings.view_transform='AgX';s.render.filepath=str(D/('interaction-'+name+'.png'));bpy.ops.render.render(write_still=True)
