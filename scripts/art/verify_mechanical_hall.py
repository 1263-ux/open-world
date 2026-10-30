"""Validate candidate GLB independently of Blender. Usage: python scripts/art/verify_mechanical_hall.py [asset-dir]."""
import json, struct, math, hashlib, pathlib, sys
D=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[2]/'public/assets/campuses/yingxi')
b=(D/'mechanical-hall.glb').read_bytes(); m=json.loads((D/'mechanical-hall.metadata.json').read_text())
magic,version,size=struct.unpack_from('<4sII',b); assert (magic,version,size)==(b'glTF',2,len(b))
n,kind=struct.unpack_from('<II',b,12); assert kind==0x4e4f534a
j=json.loads(b[20:20+n]); binary=b[28+n:]; assert struct.unpack_from('<I',b,20+n)[0]==len(binary)
assert not j.get('images') and len(j['buffers'])==1 and 'uri' not in j['buffers'][0]
assert all(not set(node)&{'translation','rotation','scale','matrix'} for node in j['nodes'])
assert hashlib.sha256(b).hexdigest()==m['artifactSha256']
def acc(i):
 a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]; f={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']]; n={'VEC3':3,'SCALAR':1}[a['type']]; f='<'+f*n; step=v.get('byteStride',struct.calcsize(f)); start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(f,binary,start+k*step) for k in range(a['count'])]
def sub(a,b):return tuple(a[i]-b[i] for i in range(3))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def length(a):return math.sqrt(dot(a,a))
meshes={}
for mesh in j['meshes']:
 tris=[]; vertices=[]
 for p in mesh['primitives']:
  pos=acc(p['attributes']['POSITION']); normals=acc(p['attributes']['NORMAL']); idx=[x[0] for x in acc(p['indices'])]
  assert len(idx)%3==0
  for k in range(0,len(idx),3):
   xyz=[pos[q] for q in idx[k:k+3]]; ns=[normals[q] for q in idx[k:k+3]]; normal=cross(sub(xyz[1],xyz[0]),sub(xyz[2],xyz[0])); l=length(normal)
   assert l>1e-9, ('degenerate',mesh['name'],xyz)
   assert all(dot(normal,v)/l/length(v)>.999 for v in ns), ('winding',mesh['name'], xyz, ns, normal)
   tris.append(xyz)
  vertices.extend(pos)
 meshes[mesh['name']]={'tris':tris,'vertices':vertices}
positions=[v for q in meshes.values() for v in q['vertices']]; bounds=[[min(p[k] for p in positions),max(p[k] for p in positions)] for k in range(3)]; count=sum(len(q['tris']) for q in meshes.values())
assert count==m['triangles_authoring'] and len(b)==m['glb_bytes'] and len(b)<1_000_000
assert abs(bounds[1][0])<1e-6 and 14.94<bounds[1][1]<15.01
for x,z in m['source_polygon']:
 assert any(abs(p[0]-(x-m['centerX']))<1e-4 and abs(p[1])<1e-4 and abs(p[2]-(z-m['centerZ']))<1e-4 for p in meshes['stone']['vertices']),(x,z)
# Test a point in the center doorway and an upper window on the central facade.
# Coordinates are source facade tangent distance t, height h, signed normal offset d.
a,c=m['source_polygon'][7:9]; L=math.dist(a,c); dx=(c[0]-a[0])/L; dz=(c[1]-a[1])/L
def local(p):
 x=p[0]+m['centerX']; z=p[2]+m['centerZ']; return ((x-a[0])*dx+(z-a[1])*dz,p[1],(x-a[0])*dz-(z-a[1])*dx)
def inside(p,tri):
 def edge(a,b,p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
 s=[edge(tri[i],tri[(i+1)%3],p) for i in range(3)];return min(s)>=-1e-5 or max(s)<=1e-5
def covered(name,t,h,offset):
 for xyz in meshes[name]['tris']:
  q=[local(p) for p in xyz]
  if all(abs(p[2]-offset)<1e-4 for p in q) and inside((t,h),q):return True
 return False
assert not covered('stone',L/2,1.5,0), 'door blocked by wall'
assert covered('clock',L/2,1.5,-.20), 'door inset missing'
assert not covered('stone',L*.39,4.4,0), 'window blocked by wall'
assert covered('glass',L*.39,4.4,-.20), 'window inset missing'
# Door jambs must face into the opening so they are visible under single-sided WebGL rendering.
for t,sign in ((L/2-1.59,1),(L/2+1.59,-1)):
 candidates=[]
 for xyz in meshes['stone']['tris']:
  q=[local(p) for p in xyz]
  if all(abs(p[0]-t)<1e-4 and -.201<=p[2]<=.001 and .19<=p[1]<=1.56 for p in q):
   normal=cross(sub(xyz[1],xyz[0]),sub(xyz[2],xyz[0])); candidates.append(dot(normal,(dx,0,dz))/length(normal))
 assert candidates and all(n*sign>.999 for n in candidates), ('door reveal inward',t,candidates)

print(f'PASS: {count} triangles, {len(b)} bytes, {len(m["source_polygon"])} exact footprint vertices; self-contained; normals and triangle winding; true door and window recesses; bounds {bounds}')
