"""Independently parse the GLB and validate source geometry plus exported face normals."""
import json, struct, pathlib, math, collections, sys, hashlib
D=pathlib.Path(__file__).resolve().parents[3]/'public/assets/campuses/yingxi'
m=json.loads((D/'mechanical-hall.metadata.json').read_text())
def read_glb(path):
 b=path.read_bytes();magic,version,size=struct.unpack_from('<4sII',b);assert (magic,version,size)==(b'glTF',2,len(b))
 length,kind=struct.unpack_from('<II',b,12);assert kind==0x4e4f534a
 j=json.loads(b[20:20+length]);binlen,bintype=struct.unpack_from('<II',b,20+length);assert bintype==0x004e4942;binary=b[28+length:28+length+binlen]
 assert len(binary)==binlen and not j.get('images') and len(j.get('buffers',[]))==1 and 'uri' not in j['buffers'][0]
 assert all(not set(n)&{'translation','rotation','scale','matrix'} for n in j['nodes'])
 def accessor(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']]; num={'VEC3':3,'SCALAR':1}[a['type']]; fmt='<'+fmt*num;step=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,binary,start+k*step) for k in range(a['count'])]
 meshes={}
 for mesh in j['meshes']:
  vertices=[];normals=[];tris=[]
  for p in mesh['primitives']:
   pos=accessor(p['attributes']['POSITION']);nor=accessor(p['attributes']['NORMAL']);indices=[x[0] for x in accessor(p['indices'])];assert len(pos)==len(nor) and len(indices)%3==0
   for i in range(0,len(indices),3):
    ix=indices[i:i+3];tris.append((tuple(pos[k] for k in ix),tuple(nor[k] for k in ix)))
   vertices+=pos;normals+=nor
  meshes[mesh['name']]={'vertices':vertices,'normals':normals,'tris':tris}
 return b,j,meshes
def sub(a,b):return tuple(a[i]-b[i] for i in range(3))
def dot(a,b):return sum(a[i]*b[i] for i in range(3))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(v):
 l=math.sqrt(dot(v,v));assert l>1e-10;return tuple(x/l for x in v)
b,j,meshes=read_glb(D/'mechanical-hall.glb')
assert hashlib.sha256(b).hexdigest()==m['artifactSha256']
positions=[p for mesh in meshes.values() for p in mesh['vertices']];triangles=sum(len(mesh['tris']) for mesh in meshes.values()); bounds=[[min(p[k] for p in positions),max(p[k] for p in positions)] for k in range(3)]
assert 14.94<=bounds[1][1]<=15 and abs(bounds[1][0])<1e-6 and len(b)<1_000_000
assert triangles==m['triangles_authoring'] and len(b)==m['glb_bytes']
stone=meshes['stone']['vertices']
for x,z in m['source_polygon']:
 assert any(abs(p[0]-(x-m['centerX']))<1e-4 and abs(p[1])<1e-4 and abs(p[2]-(z-m['centerZ']))<1e-4 for p in stone),(x,z)
# Raw triangle winding must agree with each exported per-vertex normal, not just accessor bounds.
for name,mesh in meshes.items():
 for xyz,normals in mesh['tris']:
  normal=unit(cross(sub(xyz[1],xyz[0]),sub(xyz[2],xyz[0])))
  assert all(dot(normal,unit(n))>.999 for n in normals),(name,xyz,normal,normals)
# Entire roof must face up.
assert all(n[1]>.999 for n in meshes['roof']['normals'])
# Each source edge in CCW map coordinates must have its two stone wall triangles facing outward.
P=[(x-m['centerX'],z-m['centerZ']) for x,z in m['source_polygon']]
for a,c in zip(P,P[1:]+P[:1]):
 dx=c[0]-a[0];dz=c[1]-a[1];length=math.hypot(dx,dz); expected=(dz/length,0,-dx/length)
 def onedge(p):
  u=((p[0]-a[0])*dx+(p[2]-a[1])*dz)/(length*length)
  dist=abs((p[0]-a[0])*dz-(p[2]-a[1])*dx)/length
  return -1e-5<=u<=1+1e-5 and dist<1e-4 and -.0001<=p[1]<=9.0001
 matches=[(xyz,n) for xyz,n in meshes['stone']['tris'] if all(onedge(p) for p in xyz)]
 assert len(matches)==2,(a,c,len(matches))
 assert all(dot(expected,n)>.999 for _,nn in matches for n in nn),(a,c,matches)
# Every authored box: the tower stone box, both gold cornice boxes, and 28
# parapet blocks. Check all six exported sides independently of source-code winding.
def box_faces_outward(material, x0,x1,z0,z1,y0,y1):
 lo=(x0-m['centerX'],y0,z0-m['centerZ']);hi=(x1-m['centerX'],y1,z1-m['centerZ'])
 for axis,side in ((0,-1),(0,1),(1,-1),(1,1),(2,-1),(2,1)):
  boundary=lo[axis] if side<0 else hi[axis];expect=tuple(side if k==axis else 0 for k in range(3))
  def inbox(p):return all(lo[k]-1e-4<=p[k]<=hi[k]+1e-4 for k in range(3)) and abs(p[axis]-boundary)<1e-4
  matches=[(xyz,n) for xyz,n in meshes[material]['tris'] if all(inbox(p) for p in xyz)]
  assert len(matches)==2,(material,lo,hi,axis,side,len(matches));assert all(dot(expect,n)>.999 for _,nn in matches for n in nn),(material,lo,hi,axis,side,matches)
box_faces_outward('stone',-66,-53.38,170,181.2,9,14.35)
box_faces_outward('trim',-66,-53.30,169.95,181.25,10.45,10.58)
box_faces_outward('trim',-66,-53.30,169.95,181.25,14.16,14.3)
for z in [170.2+i*1.13 for i in range(10)]:box_faces_outward('light',-53.43,-53.22,z,z+.52,14.3,14.95)
for x in [-65.6,-64.2,-62.8,-61.4,-60,-58.6,-57.2,-55.8,-54.4]:
 for z in (170.0,180.8):box_faces_outward('light',x,x+.54,z,z+.38,14.3,14.95)
# Glass windows on both +X and -X walls: map each triangle to its nearest source edge and test outward normal.
counts=collections.Counter()
for xyz,nn in meshes['glass']['tris']:
 p=tuple(sum(q[k] for q in xyz)/3 for k in range(3)); candidates=[]
 for a,c in zip(P,P[1:]+P[:1]):
  dx=c[0]-a[0];dz=c[1]-a[1];length=math.hypot(dx,dz);u=((p[0]-a[0])*dx+(p[2]-a[1])*dz)/(length*length)
  dist=((p[0]-a[0])*dz-(p[2]-a[1])*dx)/length
  if -.001<=u<=1.001 and abs(dist-.075)<.005:candidates.append((abs(dist-.075),(dz/length,0,-dx/length)))
 assert candidates,('window not on source edge',p)
 expected=min(candidates)[1];assert all(dot(expected,n)>.999 for n in nn),('window inward',p,expected,nn)
 if expected[0]>.7:counts['front']+=1
 if expected[0]<-.7:counts['back']+=1
assert counts['front']>0 and counts['back']>0,counts
# Both clock face and portal use clock material; all face +X, including marks and hands.
assert all(n[0]>.999 for n in meshes['clock']['normals'])
assert all(n[0]>.999 for n in meshes['white']['normals'])
# The clock surround and dial rings are on +X-facing planes. Test by exact authored plane.
for name,plane in [('light',-53.20),('stone',-53.18),('trim',-53.08)]:
 x=plane-m['centerX'];candidates=[(xyz,nn) for xyz,nn in meshes[name]['tris'] if all(abs(p[0]-x)<1e-4 and 10.8<=p[1]<=14.2 and abs(p[2]-(175.65-m['centerZ']))<2 for p in xyz)]
 assert candidates,(name,plane);assert all(n[0]>.999 for _,nn in candidates for n in nn),(name,plane)
# Optional regression against the old GLB: per-mesh position sets and surface areas remain unchanged.
if len(sys.argv)>1:
 _,_,old=read_glb(pathlib.Path(sys.argv[1]));assert old.keys()==meshes.keys()
 for name in meshes:
  rounded=lambda V:{tuple(round(x,5) for x in p) for p in V}
  assert rounded(old[name]['vertices'])==rounded(meshes[name]['vertices']),(name,'vertices changed')
  def area(mesh):return sum(math.sqrt(dot(cross(sub(x[1],x[0]),sub(x[2],x[0])),cross(sub(x[1],x[0]),sub(x[2],x[0]))))/2 for x,_ in mesh['tris'])
  assert abs(area(old[name])-area(meshes[name]))<1e-4,(name,'area changed')
m['glb_bounds_local_m']={'xEast':bounds[0],'yUp':bounds[1],'zSouth':bounds[2]};m['glb_triangles']=triangles;m['validation']='GLB binary parsed; all 25 source base vertices match; winding agrees with vertex normals; roof faces up, 25 shell edges outward, all six sides of all 31 authored boxes outward, front/back windows and clock faces outward; see verify.py. Bounds include superficial trim.'
# Verification is read-only: metadata is generated by the authoring workflow.
print('PASS GLB self-contained, 25 footprint vertices, all triangle winding; roof up; 25 wall edges, 31 boxes’ six faces, front/back glass, clock and surround outward; triangles',triangles,'bytes',len(b),'bounds',bounds,'window triangle counts',dict(counts));print('PASS previous geometry comparison' if len(sys.argv)>1 else 'No previous geometry comparison requested')
