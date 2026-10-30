import bpy, math, json, os, hashlib
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
colors={'stone':(0.68,0.69,0.62,1),'roof':(0.41,0.43,0.39,1),'trim':(0.76,0.66,0.43,1),'light':(0.83,0.80,0.67,1),'glass':(0.075,0.12,0.13,1),'clock':(0.025,0.045,0.044,1),'white':(0.93,0.90,0.76,1)}
mats={}
for n,c in colors.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=c;m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.84;mats[n]=m
# Geometry is batched per material; all details are original geometry, no textures.
# pt() reflects the map's X/Z plane. Explicit outward winding below accounts for it;
# clockline was already +X-facing and is intentionally not reversed.
geo={n:[[],[]] for n in colors}
def face(n,vs):
 V,F=geo[n]; start=len(V);V.extend(vs);F.append(tuple(range(start,start+len(vs))))
def box(n,x0,x1,z0,z1,h0,h1):
 p=[pt(x0,z0,h0),pt(x1,z0,h0),pt(x1,z1,h0),pt(x0,z1,h0),pt(x0,z0,h1),pt(x1,z0,h1),pt(x1,z1,h1),pt(x0,z1,h1)]
 for q in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:face(n,[p[i] for i in reversed(q)])
def wall_quad(n,a,b,h0,h1,off=0):
 x,z=a;u,v=b; L=math.hypot(u-x,v-z);nx=(v-z)/L;nz=-(u-x)/L
 face(n,[pt(x+nx*off,z+nz*off,h1),pt(u+nx*off,v+nz*off,h1),pt(u+nx*off,v+nz*off,h0),pt(x+nx*off,z+nz*off,h0)])
# exact polygon shell incl concave roof; no box approximation
# Wall faces are assembled around real recessed openings below.
poly=[Vector(pt(x,z,9)) for x,z in P]
for tri in tessellate_polygon([poly]):
 face('roof',[tuple(poly[i]) for i in reversed(tri)])
# Narrow horizontal mouldings are visual facade detail, not revised footprint.
for a,b in zip(P,P[1:]+P[:1]):
 for h in (3.15,6.05,8.6): wall_quad('trim',a,b,h,h+.13,.035)
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
 face(n,[point(t0,h1),point(t1,h1),point(t1,h0),point(t0,h0)])
def arch(n,a,b,c,w,h0,h1,off=.08):
 x,z=a;u,v=b;L=math.hypot(u-x,v-z);dx=(u-x)/L;dz=(v-z)/L;nx=dz;nz=-dx
 def point(t,h):return pt(x+dx*t+nx*off,z+dz*t+nz*off,h)
 r=w/2; spring=h1-r
 points=[point(c-r,h0),point(c+r,h0),point(c+r,spring)]
 for i in range(1,9):
  theta=math.pi*i/8;points.append(point(c+r*math.cos(theta),spring+r*math.sin(theta)))
 face(n,list(reversed(points)))
# Cut genuine openings in the source wall rather than painting windows onto it.
# The aperture reveal is 20 cm deep; an inset glazed plane closes the exterior.
def coord(a,b,t,h,off=0):
 x,z=a; u,v=b; L=math.dist(a,b); dx=(u-x)/L; dz=(v-z)/L
 return pt(x+dx*t+dz*off,z+dz*t-dx*off,h)
def polywall(mat,a,b,points,off=0):
 face(mat,[coord(a,b,t,h,off) for t,h in reversed(points)])
def reveal(a,b,outline,depth=.20):
 # Profile runs counter-clockwise in facade coordinates. Connect to inset.
 for (t0,h0),(t1,h1) in zip(outline,outline[1:]+outline[:1]):
  face('stone',[coord(a,b,t0,h0,-depth),coord(a,b,t1,h1,-depth),coord(a,b,t1,h1),coord(a,b,t0,h0)])
def aperture(a,b,c,w,h0,h1,arched=False,door=False):
 r=w/2; spring=h1-r if arched else h1
 outline=[(c-r,h0),(c+r,h0),(c+r,spring)]
 if arched:
  outline += [(c+r*math.cos(math.pi*i/12),spring+r*math.sin(math.pi*i/12)) for i in range(1,13)]
 else: outline += [(c-r,h1)]
 reveal(a,b,outline)
 polywall('clock' if door else 'glass',a,b,outline,-.20)
 # Layered architectural surround and visible joints, not a flat painted panel.
 if arched:
  arch('trim',a,b,c,w+.23,h0-.10,h1+.12,.025)
  # Above arch trim must not fill the aperture: foreground inset follows wall cut.
  # Rebuild this decorative arch as narrow radial segments instead.
  geo['trim'][1].pop(); geo['trim'][0]=geo['trim'][0][:-(3+8)]
  ro=r+.12; ri=r+.025
  for i in range(12):
   t0=math.pi*i/12; t1=math.pi*(i+1)/12
   polywall('trim',a,b,[(c+ri*math.cos(t0),spring+ri*math.sin(t0)),(c+ro*math.cos(t0),spring+ro*math.sin(t0)),(c+ro*math.cos(t1),spring+ro*math.sin(t1)),(c+ri*math.cos(t1),spring+ri*math.sin(t1))],.026)
 for side in (-1,1):panel('trim',a,b,c+side*r-.075,c+side*r+.075,h0-.1,spring,.026)
 panel('trim',a,b,c-r-.12,c+r+.12,h0-.10,h0,.04)
 if not arched:panel('trim',a,b,c-r-.12,c+r+.12,h1,h1+.12,.026)
 if not door:
  panel('light',a,b,c-.024,c+.024,h0+.06,spring-.03,-.175)
  panel('light',a,b,c-r+.03,c+r-.03,h0+(spring-h0)*.53-.022,h0+(spring-h0)*.53+.022,-.175)
 else:
  panel('light',a,b,c-.035,c+.035,h0+.05,2.35,-.175)
# Wall grids ensure true depth and keep all 25 measured base corners exact.
for a,b in zip(P,P[1:]+P[:1]):
 L=math.dist(a,b); nx=(b[1]-a[1])/L
 if L<8:
  wall_quad('stone',a,b,0,9); continue
 central=(a==P[7]); n=max(2,int(L/(3.3 if abs(nx)>=.7 else 5.0))); centers=[L*(j+.5)/n for j in range(n)]
 rows=[(.55,2.6),(3.65,5.55),(6.55,8.1)]
 for row,(h0,h1) in enumerate(rows):
  if central: centers=([L*.14,L*.5,L*.86] if row==0 else [L*.19,L*.39,L*.61,L*.81])
  low=0 if row==0 else (rows[row-1][1]+h0)/2
  high=9 if row==2 else (h1+rows[row+1][0])/2
  if central and row==0: high=3.42
  if central and row==1: low=3.42
  cursor=0
  for c in centers:
   door=central and row==0 and abs(c-L/2)<2.0
   w=3.18 if door else 1.12
   bottom=.20 if door else h0; top=3.14 if door else h1
   # Ensure neighboring windows do not intersect the wider center portal.
   if central and row==0 and not door and abs(c-L/2)<2.8: continue
   left,right=c-w/2,c+w/2
   if left<cursor or right>L: continue
   panel('stone',a,b,cursor,left,low,high,0)
   panel('stone',a,b,left,right,low,bottom,0)
   if row==0:
    radius=w/2; spring=top-radius
    # Fill the stone above the true semi-circular arch profile.
    for k in range(12):
     t0=left+w*k/12; t1=left+w*(k+1)/12
     y0=spring+math.sqrt(max(0,radius*radius-(t0-c)**2)); y1=spring+math.sqrt(max(0,radius*radius-(t1-c)**2))
     polywall('stone',a,b,[(t0,y0),(t1,y1),(t1,high),(t0,high)])
   else: panel('stone',a,b,left,right,top,high,0)
   aperture(a,b,c,w,bottom,top,row==0,door)
   cursor=right
  panel('stone',a,b,cursor,L,low,high,0)
 # Vertical piers and parapet caps emphasize the source photo's architectural rhythm.
 for j in range(n+1):
  c=L*j/n;panel('light',a,b,max(0,c-.09),min(L,c+.09),.12,8.75,.04)
  if L>18:panel('light',a,b,max(0,c-.18),min(L,c+.18),8.82,9.17,.09)
# Main central portal and clock on inferred +X face, using polygon edge itself
A0=P[7];B0=P[8]; L=math.dist(A0,B0);c=L/2
# Portal is already built as a cut recess above.
# subtle projecting sill and side framing on central block
for d in (-5.45,5.45):panel('light',A0,B0,c+d-.23,c+d+.23,.2,9.0,.12)
# Three low exterior treads, approximately 15 cm rise each; explicitly inferred.
# The treads project outside the 2-D footprint; they do not alter the footprint.
box('stone',-53.16,-51.70,173.30,178.00,.00,.12)
box('light',-53.16,-52.12,173.38,177.92,.12,.24)
box('stone',-53.16,-52.50,173.47,177.83,.24,.36)
# Corner buttresses, plinths and stepped finials establish the vertical rhythm
# seen in the reference. These are interpreted original geometry, not measurements.
for z0 in (169.25,180.78):
 box('stone',-53.52,-52.84,z0,z0+.62,.08,9.45)
 box('light',-53.58,-52.80,z0-.03,z0+.65,.08,.42)
 box('trim',-53.57,-52.79,z0-.03,z0+.65,8.87,9.10)
 box('stone',-53.50,-52.84,z0+.06,z0+.56,9.1,10.0)
 box('light',-53.55,-52.80,z0,z0+.62,9.85,10.06)
# Frontal string courses and central inscription panel left blank deliberately.
for h0,h1 in ((3.18,3.34),(6.15,6.30),(8.62,8.79)):
 panel('trim',A0,B0,.2,L-.2,h0,h1,.10)
panel('light',A0,B0,3.75,8.55,3.25,3.75,.12)
panel('stone',A0,B0,3.89,8.41,3.32,3.69,.14)
# Taller corner pinnacles around the raised clock, with cap stones.
for z0 in (169.95,180.70):
 box('stone',-53.58,-53.03,z0,z0+.50,10.55,14.75)
 box('light',-53.63,-52.98,z0-.05,z0+.55,14.63,14.95)
 box('trim',-53.62,-52.99,z0-.04,z0+.54,10.68,10.82)
# clock: circular discs drawn on tower plane aligned to central frontage
# make facing +X using constant world x, map-z horizontal
x=-53.17; zc=175.65; hc=12.52
def disk(mat,r,offset,segments=40):
 vs=[pt(x+offset,zc,hc)] + [pt(x+offset,zc+r*math.cos(2*math.pi*i/segments),hc+r*math.sin(2*math.pi*i/segments)) for i in range(segments)]
 for i in range(segments): face(mat,[vs[0],vs[(i+1)%segments+1],vs[i+1]])
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
if os.environ.get('PREVIEW_RENDER','1') != '0':
 render('front',(90,0,25),(0,0,6),55)
 render('detail',(60,0,16),(0,0,7),24)
 render('oblique',(120,-115,100),(0,0,3),155)
 render('top',(0,0,160),(0,0,0),235)
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs)
meta={'name':'机械馆','source_feature':'https://www.openstreetmap.org/way/182055474','reference_page':'https://www.tyut.edu.cn/xxgk1/xydl.htm','reference_image':'https://www.tyut.edu.cn/__local/2/5C/41/446E0BE7610583437A2528CE065_89898C9B_2AE58.jpg','reference_license':'unknown; inspected only, not embedded or distributed','centerX':cx,'centerZ':cz,'coordinate_system':'x east, y up, z south; origin at source polygon centroid; meters','front_orientation':'inferred +X from projecting central footprint, not field verified','source_polygon':P,'source_bounds':{'x':[-90.65,-52.23],'z':[112.66,236.61]},'height_m':15,'height_status':'unverified display estimate, not survey; 9m wings / 15m tower are visual-relative estimates','triangles_authoring':tris,'glb_bytes':os.path.getsize(os.path.join(D,'mechanical-hall.glb')),'software':bpy.app.version_string,'generator':'scripts/art/mechanical_hall_refined.py','attribution':'OpenStreetMap contributors; footprint ODbL, source data may be inaccurate or outdated','research_date':'2026-10-30','not_included':'No image textures, people, invented signage or interior', 'design_notes':'Original geometry based on observation only. Recessed window and portal openings, inset glazing, arched surrounds and approximate exterior steps projecting beyond the footprint. Dimensions and orientation remain visual estimates, not survey.'}
meta['glb_triangles']=tris
meta['artifactSha256']=hashlib.sha256(open(os.path.join(D,'mechanical-hall.glb'),'rb').read()).hexdigest()
json.dump(meta,open(os.path.join(D,'mechanical-hall.metadata.json'),'w'),ensure_ascii=False,indent=2)
print('CENTROID',cx,cz,'TRIS',tris,'BYTES',meta['glb_bytes'])
