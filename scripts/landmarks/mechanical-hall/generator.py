import bpy, math, json, os
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
D=os.environ.get("MODEL_OUTPUT_DIR", os.path.dirname(os.path.abspath(__file__)))
os.makedirs(D,exist_ok=True)
P=[[-90.65,113.81],[-54.82,112.66],[-54.16,133.19],[-74.05,133.82],[-73.84,140.33],[-67.52,140.13],[-66.57,169.73],[-53.35,169.3],[-52.96,181.62],[-67.38,182.08],[-66.44,211.25],[-73.52,211.47],[-73.3,218.55],[-52.8,217.9],[-52.23,235.52],[-86.35,236.61],[-86.92,218.98],[-79.17,218.73],[-79.37,212.77],[-84.5,212.92],[-86.29,157.55],[-86.84,140.61],[-79.99,140.39],[-80.2,134.01],[-89.99,134.32]]
A=0; cx=cz=0
for (x,z),(u,v) in zip(P,P[1:]+P[:1]):
 a=x*v-u*z; A+=a; cx+=(x+u)*a; cz+=(z+v)*a
cx/=3*A; cz/=3*A
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
# Authoring coordinates: x east, map z south. Blender y = minus map z; exporter maps Blender z to glTF y.
def pt(x,z,h): return (x-cx,-(z-cz),h)
colors={'stone':(0.62,0.64,0.58,1),'roof':(0.41,0.43,0.39,1),'trim':(0.76,0.66,0.43,1),'light':(0.83,0.80,0.67,1),'glass':(0.075,0.12,0.13,1),'clock':(0.025,0.045,0.044,1),'white':(0.93,0.90,0.76,1)}
mats={}
for n,c in colors.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=c;m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.84;mats[n]=m
# Geometry is batched per material; all details are original geometry, no textures.
geo={n:[[],[]] for n in colors}
def face(n,vs):
 V,F=geo[n]; start=len(V);V.extend(vs);F.append(tuple(range(start,start+len(vs))))
def box(n,x0,x1,z0,z1,h0,h1):
 p=[pt(x0,z0,h0),pt(x1,z0,h0),pt(x1,z1,h0),pt(x0,z1,h0),pt(x0,z0,h1),pt(x1,z0,h1),pt(x1,z1,h1),pt(x0,z1,h1)]
 for q in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:face(n,[p[i] for i in q])
def wall_quad(n,a,b,h0,h1,off=0):
 x,z=a;u,v=b; L=math.hypot(u-x,v-z);nx=(v-z)/L;nz=-(u-x)/L
 face(n,[pt(x+nx*off,z+nz*off,h0),pt(u+nx*off,v+nz*off,h0),pt(u+nx*off,v+nz*off,h1),pt(x+nx*off,z+nz*off,h1)])
# exact polygon shell incl concave roof; no box approximation
for a,b in zip(P,P[1:]+P[:1]):wall_quad('stone',a,b,0,9)
poly=[Vector(pt(x,z,9)) for x,z in P]
for tri in tessellate_polygon([poly]):
 face('roof',[tuple(poly[i]) for i in tri])
# Narrow horizontal mouldings are visual facade detail, not revised footprint.
for a,b in zip(P,P[1:]+P[:1]):
 for h in (0.22,3.15,6.05,8.6): wall_quad('trim',a,b,h,h+.13,.035)
# raised central tower with stepped top; true height unknown
box('stone',-66,-53.38,170.0,181.2,9,14.35)
box('trim',-66,-53.30,169.95,181.25,10.45,10.58)
box('trim',-66,-53.30,169.95,181.25,14.16,14.3)
# crenellations on main tower front and sides (all <=15m)
for z in [170.2+i*1.13 for i in range(10)]:box('light',-53.43,-53.22,z,z+.52,14.3,14.95)
for x in [-65.6,-64.2,-62.8,-61.4,-60,-58.6,-57.2,-55.8,-54.4]:
 for z in (170.0,180.8):box('light',x,x+.54,z,z+.38,14.3,14.95)
# use geometry on outward face coordinate t, h; segment normals computed from CCW map polygon
def panel(n,a,b,t0,t1,h0,h1,off=.07):
 x,z=a; u,v=b; L=math.hypot(u-x,v-z);dx=(u-x)/L;dz=(v-z)/L;nx=dz;nz=-dx
 def point(t,h):return pt(x+dx*t+nx*off,z+dz*t+nz*off,h)
 face(n,[point(t0,h0),point(t1,h0),point(t1,h1),point(t0,h1)])
def arch(n,a,b,c,w,h0,h1,off=.08):
 x,z=a;u,v=b;L=math.hypot(u-x,v-z);dx=(u-x)/L;dz=(v-z)/L;nx=dz;nz=-dx
 def point(t,h):return pt(x+dx*t+nx*off,z+dz*t+nz*off,h)
 r=w/2; spring=h1-r
 points=[point(c-r,h0),point(c+r,h0),point(c+r,spring)]
 for i in range(1,9):
  theta=math.pi*i/8;points.append(point(c+r*math.cos(theta),spring+r*math.sin(theta)))
 face(n,points)
def window(a,b,c,h0,h1,w,arched=False):
 if arched:
  arch('trim',a,b,c,w+.24,h0-.1,h1+.1,.06);arch('glass',a,b,c,w,h0,h1,.075)
 else:
  panel('trim',a,b,c-w/2-.12,c+w/2+.12,h0-.1,h1+.1,.06);panel('glass',a,b,c-w/2,c+w/2,h0,h1,.075)
 panel('light',a,b,c-.025,c+.025,h0,h1-.12,.085)
 panel('light',a,b,c-w/2,c+w/2,(h0+h1)/2-.025,(h0+h1)/2+.025,.085)
# Window rows on outward-facing longitudinal facades only. Curvature and exact spacing are estimates.
for a,b in zip(P,P[1:]+P[:1]):
 L=math.dist(a,b); nx=(b[1]-a[1])/L
 if L<8 or abs(nx)<.7:continue
 central=(a==P[7]); n=max(2,int(L/3.3))
 for j in range(n):
  c=L*(j+.5)/n
  for h0,h1 in [(0.55,2.6),(3.65,5.55),(6.55,8.1)]:
   if central and h0<1 and abs(c-L/2)<2.0: continue
   window(a,b,c,h0,h1,1.12,h0<1)
 # vertical pilasters and parapet accents
 for j in range(n+1):
  c=L*j/n;panel('light',a,b,max(0,c-.12),min(L,c+.12),.12,8.75,.08)
  if L>18:panel('light',a,b,max(0,c-.18),min(L,c+.18),8.82,9.17,.09)
# Main central portal and clock on inferred +X face, using polygon edge itself
A0=P[7];B0=P[8]; L=math.dist(A0,B0);c=L/2
arch('trim',A0,B0,c,3.7,.18,3.42,.13);arch('clock',A0,B0,c,3.18,.2,3.14,.15)
panel('light',A0,B0,c-.055,c+.055,.2,2.2,.17)
# subtle projecting sill and side framing on central block
for d in (-5.45,5.45):panel('light',A0,B0,c+d-.23,c+d+.23,.2,9.0,.12)
# clock: circular discs drawn on tower plane aligned to central frontage
# make facing +X using constant world x, map-z horizontal
x=-53.17; zc=175.65; hc=12.52
def disk(mat,r,offset,segments=40):
 vs=[pt(x+offset,zc,hc)] + [pt(x+offset,zc+r*math.cos(2*math.pi*i/segments),hc+r*math.sin(2*math.pi*i/segments)) for i in range(segments)]
 for i in range(segments): face(mat,[vs[0],vs[i+1],vs[(i+1)%segments+1]])
arch('light',[-53.22,170],[-53.22,181.2],5.65,2.9,10.88,14.18,.02)
arch('stone',[-53.22,170],[-53.22,181.2],5.65,2.50,11.0,14.0,.04)
disk('trim',1.16,.09);disk('clock',.98,.11)
# hour marks and hands as thin small quads in the face plane
def clockline(z0,h0,z1,h1,w,mat='white'):
 dz=z1-z0;dh=h1-h0;ll=math.hypot(dz,dh);az=-dh/ll*w/2;ah=dz/ll*w/2
 face(mat,[pt(x+.125,z0+az,h0+ah),pt(x+.125,z1+az,h1+ah),pt(x+.125,z1-az,h1-ah),pt(x+.125,z0-az,h0-ah)])
for i in range(12):
 ang=2*math.pi*i/12;clockline(zc+.72*math.sin(ang),hc+.72*math.cos(ang),zc+.86*math.sin(ang),hc+.86*math.cos(ang),.045)
clockline(zc,hc,zc+.04,hc+.58,.06);clockline(zc,hc,zc+.43,hc-.19,.06)
# batch each material into a mesh; normals resolved by exporter
objs=[]
for n,(verts,faces) in geo.items():
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(mats[n]);objs.append(ob)
# Export only authored building geometry. Exclude preview camera/lights.
bpy.ops.object.select_all(action='DESELECT')
for o in objs:o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'mechanical-hall.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
# Deterministic CPU render, reference-looking but photo remains outside deliverable.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.render.resolution_x=1200;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.75,.8,.84,1); scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
scene.view_settings.view_transform='AgX'
# Preview-only neutral ground for silhouette contrast; created after selection-only GLB export.
ground=bpy.data.materials.new('preview-ground');ground.diffuse_color=(.12,.16,.17,1);ground.use_nodes=True;ground.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.12,.16,.17,1);ground.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
bpy.ops.mesh.primitive_plane_add(size=500,location=(0,0,-.02));bpy.context.object.data.materials.append(ground)
# large area sunlight
bpy.ops.object.light_add(type='AREA', location=(75,-65,110));lamp=bpy.context.object;lamp.data.energy=4500;lamp.data.shape='DISK';lamp.data.size=90
bpy.ops.object.light_add(type='SUN', location=(0,0,60));sun=bpy.context.object;sun.data.energy=1.5;sun.rotation_euler=(math.radians(15),math.radians(45),math.radians(-10))
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO'
def render(name, pos,target,ortho):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=ortho
 scene.render.filepath=os.path.join(D,name+'.png');bpy.ops.render.render(write_still=True)
# world transformed view: +X front; near central block for readable detail, oblique/top show entire footprint
render('front',(90,0,25),(0,0,6),55)
render('oblique',(120,-115,100),(0,0,3),155)
render('top',(0,0,160),(0,0,0),235)
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs)
meta={'name':'机械馆','source_feature':'https://www.openstreetmap.org/way/182055474','reference_page':'https://www.tyut.edu.cn/xxgk1/xydl.htm','reference_image':'https://www.tyut.edu.cn/__local/2/5C/41/446E0BE7610583437A2528CE065_89898C9B_2AE58.jpg','reference_license':'unknown; inspected only, not embedded or distributed','centerX':cx,'centerZ':cz,'coordinate_system':'x east, y up, z south; origin at source polygon centroid; meters','front_orientation':'inferred +X from projecting central footprint, not field verified','source_polygon':P,'source_bounds':{'x':[-90.65,-52.23],'z':[112.66,236.61]},'height_m':15,'height_status':'unverified display estimate, not survey; 9m wings / 15m tower are visual-relative estimates','triangles_authoring':tris,'glb_bytes':os.path.getsize(os.path.join(D,'mechanical-hall.glb')),'software':bpy.app.version_string,'generator':'generator.py','attribution':'OpenStreetMap contributors; footprint ODbL, source data may be inaccurate or outdated','research_date':'2026-10-30','not_included':'No image textures, people, invented signage or interior'}
json.dump(meta,open(os.path.join(D,'mechanical-hall.metadata.json'),'w'),ensure_ascii=False,indent=2)
print('CENTROID',cx,cz,'TRIS',tris,'BYTES',meta['glb_bytes'])
