"""Validate standalone candidate with no repository or runtime mutation."""
import json,struct,math,pathlib,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
D=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'public/assets/campuses/yingxi'
b=(D/'qingze-reading-garden.glb').read_bytes() if (D/'qingze-reading-garden.glb').exists() else (D/'qingze-original-setting.glb').read_bytes()
magic,version,size=struct.unpack_from('<4sII',b);assert (magic,version,size)==(b'glTF',2,len(b))
n,kind=struct.unpack_from('<II',b,12);assert kind==0x4e4f534a;j=json.loads(b[20:20+n]);blen,bkind=struct.unpack_from('<II',b,20+n);assert bkind==0x004e4942;binary=b[28+n:28+n+blen]
assert not j.get('images') and len(j['buffers'])==1 and 'uri' not in j['buffers'][0]
assert all(not any(k in nd for k in ('translation','rotation','scale','matrix','camera')) for nd in j['nodes'])
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];count={'VEC3':3,'SCALAR':1}[a['type']];fmt='<'+fmt*count;step=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,binary,start+k*step) for k in range(a['count'])]
positions=[];tris=0;degenerate=0
for mesh in j['meshes']:
 for p in mesh['primitives']:
  xyz=acc(p['attributes']['POSITION']);indices=[x[0] for x in acc(p['indices'])];positions+=xyz;tris+=len(indices)//3
  for i in range(0,len(indices),3):
   pa,pb,pc=[xyz[x] for x in indices[i:i+3]];u=[pb[k]-pa[k] for k in range(3)];v=[pc[k]-pa[k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   if sum(t*t for t in cross)<1e-16:degenerate+=1
bounds=[[min(p[i] for p in positions),max(p[i] for p in positions)] for i in range(3)]
assert -.01<=bounds[1][0]<.01 and 5<bounds[1][1]<9
# Exact source quadrilateral, not just its bounding rectangle.
spatial=json.loads((ROOT/'src/campus-data/spatial.json').read_text())
park=next(f['polygon'] for f in spatial['yingxi']['features'] if f['id']=='343238097')
if park[0]==park[-1]: park=park[:-1]
def inside(x,z):
 hit=False
 for i in range(len(park)):
  a,c=park[i],park[i-1]
  if (a[1]>z)!=(c[1]>z) and x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0]:hit=not hit
 return hit
assert all(inside(35+x,205+z) for x in bounds[0] for z in bounds[2]), 'model bounds escape park polygon'
assert 205+bounds[2][0]>173, 'old route zone changed'
assert degenerate==0, f'{degenerate} degenerate triangles'
# Calm court is a single coplanar 64-sided disk with two inlay bands.
court_area=0.0; court_faces=0
for obj in j['meshes']:
 for p in obj['primitives']:
  xyz=acc(p['attributes']['POSITION']);ii=[x[0] for x in acc(p['indices'])]
  for i in range(0,len(ii),3):
   a,c,d=[xyz[k] for k in ii[i:i+3]]
   if all(abs(v[1]-.046)<1e-5 for v in (a,c,d)):
    signed=((c[2]-a[2])*(d[0]-a[0])-(c[0]-a[0])*(d[2]-a[2]))/2
    if signed>0: court_faces+=1;court_area+=signed
assert court_faces==576, f'unexpected court top count: {court_faces}'
assert abs(court_area-64*.5*8.2**2*math.sin(2*math.pi/64))<1e-4, 'court disk area differs'
print('PASS 576 coplanar upward court triangles; disk area',round(court_area,6),'m²')
metadata=D/'qingze-reading-garden.metadata.json'
if metadata.exists():
 m=json.loads(metadata.read_text());assert hashlib.sha256(b).hexdigest()==m['artifactSha256']
 assert len(b)==m['glb_bytes'] and tris==m['glb_triangles']
 assert m['centerX']==35 and m['centerZ']==205
 for name,entry in m['photoCandidate']['semanticPoints'].items():
  world=entry['pointWorld'];local=(world[0]-35,world[1],world[2]-205)
  assert min(math.dist(local,p) for p in positions)<2e-5, ('semantic point is not an exported vertex',name)
 assert len(m['solidColliders'])==19
 for obj in m['solidColliders']:
  poly=obj['polygon'];assert len(poly)>=3 and obj['height']>0 and obj['status']=='model-design-only'
  area=abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))/2)
  assert area>.001 and all(inside(*p) for p in poly), ('invalid collider',obj['id'])
 runtime_layout=ROOT/'src/scene/qingze-garden-layout.json'
 if runtime_layout.exists():
  runtime=json.loads(runtime_layout.read_text())
  assert runtime['sourceSha256']==m['artifactSha256'], 'runtime collider source hash differs'
  assert runtime['solidColliders']==m['solidColliders'], 'runtime colliders differ from approved design metadata'
 print('PASS metadata SHA, semantic vertices, 19 solid bounds, and matching runtime proxies')
print('PASS self-contained GLB; 0 degenerate triangles; exact park polygon contains bbox; old z=160–173 route clear')
print('local X/Y/Z bounds:',bounds,'triangles:',tris,'draw primitives:',sum(len(m['primitives']) for m in j['meshes']),'materials:',len(j['materials']),'bytes:',len(b))
print('SHA-256:',hashlib.sha256(b).hexdigest())
