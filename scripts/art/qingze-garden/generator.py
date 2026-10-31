import bpy, math, random, os, tempfile
from mathutils import Vector
D=os.environ.get('MODEL_OUTPUT_DIR',os.path.join(tempfile.gettempdir(),'qingze-garden-output'));os.makedirs(D,exist_ok=True);random.seed(316)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Coordinates: Blender +x east, +y north, +z up; glTF +X east,+Y up,+Z south.
# All dimensions and site placement are original game-design estimates, not survey.
colors={'stone':(.69,.68,.61,1),'pale':(.80,.77,.68,1),'sand':(.75,.72,.63,1),'tile1':(.78,.75,.67,1),'tile2':(.74,.72,.65,1),'tile3':(.81,.78,.70,1),'wood':(.40,.24,.15,1),'metal':(.25,.28,.24,1),'soil':(.22,.25,.17,1),'bark':(.31,.28,.21,1),'leaf1':(.27,.39,.22,1),'leaf2':(.35,.48,.26,1),'leaf3':(.44,.54,.29,1),'flower':(.61,.46,.48,1),'flowerLight':(.82,.74,.61,1)}
mats={}
for n,c in colors.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.88;mats[n]=m
objects=[]
def mesh(name,verts,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(mats[mat]);objects.append(ob);return ob
def box(name,loc,scale,mat,angle=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;o.rotation_euler.z=angle;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);objects.append(o);return o
def ring(name,r0,r1,h0,h1,start=0,end=2*math.pi,segments=64,mat='stone'):
 verts=[];faces=[]
 for i in range(segments+1):
  a=start+(end-start)*i/segments;ca,sa=math.cos(a),math.sin(a)
  verts.extend([(r0*ca,r0*sa,h0),(r1*ca,r1*sa,h0),(r0*ca,r0*sa,h1),(r1*ca,r1*sa,h1)])
 for i in range(segments):
  a=4*i;b=a+4;faces.extend([(a+2,a+3,b+3,b+2),(a,b,b+1,a+1),(a+1,b+1,b+3,a+3),(a,a+2,b+2,b)])
 faces.extend([(0,1,3,2),(4*segments,4*segments+2,4*segments+3,4*segments+1)])
 return mesh(name,verts,faces,mat)
def ellipsoid(name,loc,scale,mat,segments=10,rings=6):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);objects.append(o);return o
def segment(name,a,b,r0,r1,mat,vertices=7):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r0,radius2=r1,depth=d.length,location=(a+b)*.5);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mats[mat]);objects.append(o);return o
# Calm court: one coplanar stone surface with two broad inlay bands.
# Keep RNG state identical to the 160 removed original wedge material choices.
for _ in range(160): random.choice(['tile1','tile2','tile3'])
def court_region(name, inner, outer, mat, n=64):
 verts=[]; faces=[]
 if inner == 0:
  verts.append((0,0,.046))
  for i in range(n):
   a=2*math.pi*i/n; verts.append((outer*math.cos(a),outer*math.sin(a),.046))
  for i in range(n): faces.append((0,1+i,1+(i+1)%n))
 else:
  for i in range(n):
   a=2*math.pi*i/n; verts.extend([(inner*math.cos(a),inner*math.sin(a),.046),(outer*math.cos(a),outer*math.sin(a),.046)])
  for i in range(n):
   j=(i+1)%n; faces.append((2*i,2*i+1,2*j+1,2*j))
 return mesh(name,verts,faces,mat)
for name,r0,r1,material in [('Court center',0,3.73,'tile1'),('Court inlay A',3.73,3.91,'sand'),('Court middle',3.91,5.73,'tile1'),('Court inlay B',5.73,5.91,'sand'),('Court outer',5.91,8.20,'tile1')]:
 court_region(name,r0,r1,material)
# Outer edge only; no duplicate top surface.
v=[];f=[]
for i in range(64):
 a=2*math.pi*i/64;v.extend([(8.2*math.cos(a),8.2*math.sin(a),0),(8.2*math.cos(a),8.2*math.sin(a),.046)])
for i in range(64):
 j=(i+1)%64;f.append((2*i,2*j,2*j+1,2*i+1))
mesh('Court edge',v,f,'stone')
# Approach toward existing route, flush walking surface: local +Y = north.
box('Open approach',(0,12.2,.025),(3.4,8.8,.05),'tile1')
for y in (9,10.5,12,13.5,15):box('Approach joint',(0,y,.052),(3.4,.028,.004),'stone')
# Rear crescent coping, deliberately open at north, no balustrade or bas relief.
for start,end in [(195,238),(248,292),(302,345)]:
 a,b=map(math.radians,(start,end));ring('Low curved coping',7.25,7.63,.04,.58,a,b,20,'pale');ring('Coping cap',7.18,7.70,.58,.65,a,b,20,'sand')
 # integrated curved timber seat, 46cm high, original backless seating
 ring('Curved seat',6.60,7.20,.43,.49,a+.04,b-.04,16,'wood')
 for t in (.18,.55,.82):
  q=a+(b-a)*t;box('Seat support',(6.90*math.cos(q),6.90*math.sin(q),.22),(.13,.13,.42),'metal')
# Central low elliptical planted island, a living subject rather than a copied monument.
def oval(name,rx,ry,h0,h1,mat,n=48):
 verts=[];faces=[]
 for i in range(n):
  a=2*math.pi*i/n;verts.extend([(rx*math.cos(a),ry*math.sin(a),h0),(rx*math.cos(a),ry*math.sin(a),h1)])
 faces.append(tuple(2*i for i in range(n-1,-1,-1)));faces.append(tuple(2*i+1 for i in range(n)))
 for i in range(n):j=(i+1)%n;faces.append((2*i,2*j,2*j+1,2*i+1))
 return mesh(name,verts,faces,mat)
plant_start=len(objects)
oval('Oval stone planter',2.55,1.22,.05,.40,'pale');oval('Planting bed',2.40,1.07,.40,.42,'soil')
# Dense low planting and a few coherent flower groups; no floating lollipops.
plant_leaves=[[],[]]
for i in range(19):
 while True:
  x=random.uniform(-2.15,2.15);y=random.uniform(-.92,.92)
  if (x/2.15)**2+(y/.92)**2<.85:break
 ellipsoid('Low planted mass',(x,y,.53),(.35+random.random()*.16,.27+random.random()*.12,.16+random.random()*.09),['leaf1','leaf2','leaf3'][i%3],8,5)
 for k in range(5):
  a=2*math.pi*k/5+random.uniform(-.25,.25);dx,dy=math.cos(a),math.sin(a);v,f=plant_leaves;idx=len(v)
  v.extend([(x,y,.62),(x+dx*.18-dy*.07,y+dy*.18+dx*.07,.68),(x+dx*.35,y+dy*.35,.84+random.uniform(-.06,.08)),(x+dx*.18+dy*.07,y+dy*.18-dx*.07,.68)])
  f.extend([(idx,idx+1,idx+2),(idx,idx+2,idx+3)])
mesh('Plant leaf tufts',plant_leaves[0],plant_leaves[1],'leaf2')
for i,(x,y) in enumerate([(-1.65,.10),(-.65,-.24),(.50,.24),(1.40,-.15)]):
 for k in range(6):
  xx=x+random.uniform(-.17,.17);yy=y+random.uniform(-.14,.14);zz=.81+random.uniform(-.02,.09)
  ellipsoid('Flower cluster',(xx,yy,zz),(.12,.12,.085), 'flower' if i%2 else 'flowerLight',7,4)
# Offset the garden island for a less formal, original composition.
for ob in objects[plant_start:]:
 ob.location.x += .85; ob.location.y -= .4
# Original willow-like trees: fine hanging twig sprays with pointed leaves,
# not opaque ellipsoidal blobs. All leaves are original flat-shaded geometry.
leafgeo={name:[[],[]] for name in ('leaf1','leaf2','leaf3')}
def blade(name,base,tip,width,tangent):
 verts,faces=leafgeo[name];base=Vector(base);tip=Vector(tip);tangent=Vector(tangent).normalized()*width
 mid=(base+tip)*.5;i=len(verts);verts.extend([tuple(base),tuple(mid+tangent),tuple(tip),tuple(mid-tangent)]);faces.extend([(i,i+1,i+2),(i,i+2,i+3)])
def willow(x,y,h,seed):
 rng=random.Random(seed);segment('Willow trunk',(x,y,0),(x+.08,y,h*.68),.29,.15,'bark',9)
 # Close-packed, overlapping crown lobes conceal the branch junction; none
 # of the supporting trunk extends above the organic canopy.
 ellipsoid('Willow canopy',(x,y,h*.79),(1.22,1.10,.65),'leaf2',10,6)
 for i in range(8):
  a=2*math.pi*i/8+rng.uniform(-.25,.25);rr=rng.uniform(.55,1.25)
  ellipsoid('Willow canopy lobe',(x+rr*math.cos(a),y+rr*math.sin(a),h*.77+rng.uniform(-.35,.48)),(rng.uniform(.62,.95),rng.uniform(.58,.9),rng.uniform(.52,.82)),['leaf1','leaf2','leaf3'][i%3],8,5)
 for i in range(10):
  a=2*math.pi*i/10+rng.uniform(-.22,.22);tangent=(-math.sin(a),math.cos(a),0)
  for j in range(3):
   rr=rng.uniform(.75,1.70);xx=x+rr*math.cos(a);yy=y+rr*math.sin(a);zz=h*.76+rng.uniform(-.20,.24)
   length=rng.uniform(1.25,2.05);drift=rng.uniform(.32,.78)
   def pos(t):return (xx+math.cos(a)*drift*math.sin(t*math.pi/2),yy+math.sin(a)*drift*math.sin(t*math.pi/2),zz-length*t**1.15)
   segment('Curving foliage twig',pos(0),pos(.5),.012,.009,'leaf1',5)
   segment('Curving foliage twig',pos(.5),pos(1),.009,.003,'leaf1',5)
   for k in range(7):
    t=(k+.5)/8;cx,cy,cz=pos(t)
    for side in (-1,1):
     v=(cx+side*tangent[0]*.25,cy+side*tangent[1]*.25,cz-.42)
     blade(['leaf1','leaf2','leaf3'][(i+k+(side>0))%3],(cx,cy,cz),v,.095,(math.cos(a),math.sin(a),.08))
willow(-6.5,-6.5,6.3,31);willow(-2.1,-8.1,7.0,22);willow(6.2,-5.9,5.9,19)
for name,(verts,faces) in leafgeo.items():mesh('Willow pointed leaves',verts,faces,name)
# Oriented-face-order-independent fingerprint of untouched source objects.
import hashlib,json
bpy.context.view_layer.update()
exclude={'Court base','Paving course','Fine paving inlay','Court center','Court inlay A','Court middle','Court inlay B','Court outer','Court edge'}
records=[]
for o in objects:
 if o.name.split('.')[0] in exclude: continue
 v=[[round(q,6) for q in o.matrix_world @ p.co] for p in o.data.vertices]
 polys=[]
 for p in o.data.polygons:
  a=tuple(p.vertices);polys.append(min(a[i:]+a[:i] for i in range(len(a))))
 polys.sort();records.append([o.name.split('.')[0],o.data.materials[0].name,v,polys])
with open(D+'/unchanged-geometry.json','w') as f:json.dump({'objects':len(records),'sha256':hashlib.sha256(repr(records).encode()).hexdigest()},f)
# Batch by material, reduce draw calls while retaining authored elements.
bpy.ops.object.select_all(action='DESELECT')
joined=[]
groups={name:[o for o in objects if o.data.materials and o.data.materials[0]==mats[name]] for name in colors}
for name in colors:
 obs=groups[name]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=bpy.context.object;ob.name='Garden_'+name
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);joined.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for o in joined:o.select_set(True)
bpy.context.view_layer.objects.active=joined[0]
bpy.ops.export_scene.gltf(filepath=D+'/qingze-original-setting.glb',export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined)
print('STATS',tris,os.path.getsize(D+'/qingze-original-setting.glb'))
if os.environ.get('PREVIEW_RENDER') == '1':
 # Existing CC0 student used as a preview-only human scale reference, after export.
 # The source character, camera and floor are never packed into this candidate.
 if os.environ.get('QINGZE_CHARACTER_GLB'):
  pre=set(bpy.context.scene.objects)
  bpy.ops.import_scene.gltf(filepath=os.environ['QINGZE_CHARACTER_GLB'])
  added=[o for o in bpy.context.scene.objects if o not in pre]
  rig=next(o for o in added if o.type=='ARMATURE')
  if rig.animation_data:
   for t in rig.animation_data.nla_tracks:t.mute=True
   rig.animation_data.action=bpy.data.actions.get('Idle_CharacterArmature')
  bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
  character_mesh=[o for o in added if o.type=='MESH' and o.parent==rig]
  world_corners=[o.matrix_world @ Vector(v) for o in character_mesh for v in o.bound_box]
  lo=min(v.z for v in world_corners);hi=max(v.z for v in world_corners)
  scale=1.75/(hi-lo);rig.scale=(scale,scale,scale);rig.location=(-3.7,3.2,-lo*scale)
 # Preview-only ground, camera and one directional sun; not in GLB.
 preview=bpy.data.materials.new('preview grass');preview.diffuse_color=(.45,.56,.38,1)
 bpy.ops.mesh.primitive_plane_add(size=120,location=(0,0,-.025));bpy.context.object.data.materials.append(preview)
 bpy.ops.object.light_add(type='SUN',location=(12,16,20));sun=bpy.context.object;sun.rotation_euler=Vector((-.7,.55,-1.15)).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.15;sun.data.color=(1,.823,.658)
 s=bpy.context.scene;s.world.use_nodes=True;bg=s.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.47,.665,.73,1);bg.inputs['Strength'].default_value=.5;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=1200;s.render.resolution_y=750;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX'
 bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.data.lens=32
 def render(name,pos,target,lens):
  cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens;s.render.filepath=D+'/'+name+'.png';bpy.ops.render.render(write_still=True)
 render('approach',(0,20,2.1),(0,-1,1.7),32)
 render('front-detail',(0,10.5,1.7),(0,-.8,1.2),28)
 render('oblique',(18,21,16),(0,0,1),34)
 print('DONE')
