# Actual scene geometry with a shared licensed LDR sky. Offline comparison, not gameplay.
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent;P=D.parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
for p in [D/'../../receiving-space-v2/edge-fade/receiving-edge-fade.glb',D/'../threshold-evidence/threshold.glb']:
 bpy.ops.import_scene.gltf(filepath=str(p.resolve()))
s=bpy.context.scene;cv=lambda p:Vector((p[0],-p[2],p[1]))
s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.resolution_x=1000;s.render.resolution_y=700;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Shared LDR sky comparison');s.world.use_nodes=True;bg=s.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.27,.35,.42,1);bg.inputs[1].default_value=.7
for name,pos,power,size,color in [('Sky',(0,9,-13),1500,12,(.75,.84,1)),('Warm receiving',(-3,4,-3),650,5,(1,.78,.52))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=cv(pos);o.rotation_euler=(cv((0,0,-13))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();s.camera=bpy.context.object;s.camera.data.lens=32;s.camera.location=cv((3.7,1.55,-7.4));s.camera.rotation_euler=(cv((2,.28,-16))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.view_settings.view_transform='AgX'
if '--only-b' not in sys.argv:
 s.render.filepath=str(D/'A-neutral.png');bpy.ops.render.render(write_still=True)
tex=s.world.node_tree.nodes.new('ShaderNodeTexEnvironment');tex.image=bpy.data.images.load(str(P/'asset-recovery/hdri-study/hdri-preview.png'));s.world.node_tree.links.new(tex.outputs['Color'],bg.inputs[0]);bg.inputs[1].default_value=.7
count=0
for o in bpy.data.objects:
 if o.type!='MESH' or not o.name.startswith('Shallow_water_fading_edge_not_plinth'):continue
 count+=1
 if sum(p.normal.z for p in o.data.polygons)<0:o.data.flip_normals()
 for v in o.data.vertices:
  x,z=v.co.x,-v.co.y;v.co.z+=.012*math.sin(.9*x+1.4*z)+.006*math.sin(2.1*x-.6*z)
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    n.inputs['Roughness'].default_value=.16;n.inputs['Metallic'].default_value=0
    linear=lambda b:(b/255)/12.92 if b/255<=.04045 else ((b/255+.055)/1.055)**2.4
    tint=tuple(linear(b) for b in (113,156,173))+(1,)
    base=n.inputs['Base Color'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=tint
    if base.links:
     link=base.links[0];source=link.from_socket;m.node_tree.links.remove(link);m.node_tree.links.new(source,mix.inputs[1])
    else:mix.inputs[1].default_value=base.default_value
    m.node_tree.links.new(mix.outputs[0],base)
assert count==1,('unexpected actual water meshes',count)
s.render.filepath=str(D/'C-tinted-water.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(D/'environment-comparison.blend'))
