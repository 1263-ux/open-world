#!/usr/bin/env python3
"""Independent GLB byte-level check; stdlib only, not Blender-dependent."""
import json, os, struct, math, hashlib
from pathlib import Path
D=Path(__file__).resolve().parents[3]/'public/assets/campuses/huyu'; path=D/'meihua-classroom-group.glb'
expected={
'028c91bf-ac23-439e-bfa5-7f5138dac851':[[-81.93,-57.65],[-79.21,-70.87],[-89.49,-72.99],[-92.22,-59.77]],
'37283b65-e218-4a49-9c81-ad5015a8f078':[[-71.16,-52.06],[-66.22,-63.0],[-74.42,-66.7],[-79.37,-55.76]],
'5ac53a1f-ce87-4161-9e1a-6e88741e0e3f':[[-63.88,-33.7],[-73.61,-44.93],[-81.63,-37.98],[-71.9,-26.76]],
'b457deb5-22d4-4522-b66a-e2fe8a723d92':[[-92.52,-36.2],[-89.39,-20.6],[-78.99,-22.69],[-82.13,-38.29]],
'69b27930-08ee-49ac-abf6-6589dcb1cf64':[[-84.89,-49.07],[-87.24,-53.82],[-96.75,-49.12],[-94.4,-44.36]]}
b=open(path,'rb').read();magic,version,length=struct.unpack_from('<4sII',b);assert magic==b'glTF' and version==2 and length==len(b) and len(b)<500000
jl,jt=struct.unpack_from('<II',b,12);assert jt==0x4e4f534a;j=json.loads(b[20:20+jl]);pos=20+jl;bl,bt=struct.unpack_from('<II',b,pos);assert bt==0x004e4942;binary=b[pos+8:pos+8+bl]
assert not j.get('images') and all('uri' not in q for q in j['buffers'])
assert all(not any(k in n for k in ('matrix','translation','rotation','scale')) for n in j['nodes']), 'Verifier expects baked identity transforms'
meta=json.load(open(D/'meihua-classroom-group.metadata.json'));cx,cz=meta['centerX'],meta['centerZ'];assert meta['sourceFootprintsWorldXZ']==expected
assert hashlib.sha256(b).hexdigest()==meta['artifactSha256']
nodes={n.get('name'):n for n in j['nodes']}
def read_accessor(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];assert v.get('buffer',0)==0
 fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]; comps={'SCALAR':1,'VEC3':3}[a['type']];size=struct.calcsize('<'+fmt*comps);stride=v.get('byteStride',size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*comps,binary,offset+k*stride) for k in range(a['count'])]
def positions(name):
 n=nodes[name];m=j['meshes'][n['mesh']];out=[]
 for p in m['primitives']:out.extend(read_accessor(p['attributes']['POSITION']))
 return out
for ident,poly in expected.items():
 pts=positions('Source_'+ident)
 for x,z in poly:
  assert any(abs(a-(x-cx))<1e-4 and abs(h)<1e-5 and abs(c-(z-cz))<1e-4 for a,h,c in pts),(ident,x,z)
conn=meta['inferredConnector'];assert conn['confidence']=='inferred' and conn['objectName']=='Inferred_Connector'
def inside(pt,poly):
 x,y=pt; result=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: result=not result
 return result
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def intersects(a,b,c,d):return cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0
C=conn['fullWorldXZPolygon']
for ident,P in expected.items():
 assert any(inside(a,C) for a in P) or any(inside(a,P) for a in C) or any(intersects(a,b,c,d) for a,b in zip(P,P[1:]+P[:1]) for c,d in zip(C,C[1:]+C[:1])), ident
for x,z in conn['fullWorldXZPolygon']:
 assert any(abs(a-(x-cx))<1e-4 and abs(h)<1e-5 and abs(c-(z-cz))<1e-4 for a,h,c in positions('Inferred_Connector'))
allp=[];tri=0
for m in j['meshes']:
 for p in m['primitives']:
  assert p.get('mode',4)==4;allp.extend(read_accessor(p['attributes']['POSITION']));tri+=len(read_accessor(p['indices']))//3 if 'indices' in p else len(read_accessor(p['attributes']['POSITION']))//3
assert min(v[1] for v in allp)>=-1e-5 and abs(max(v[1] for v in allp)-4.5)<1e-5
assert tri<10000
assert 'a04a7502-f32b-4fa2-acee-1f08811fee44' not in str(j['nodes'])
print('PASS: 20/20 exact source base vertices in 5 named shells; X east / Y up / Z south; inferred connector separately named, overlaps all 5 shells, and its base matches metadata; height 4.5 m; no external buffers/images; %s triangles; %s bytes'%(tri,len(b)))
# Exported roof normal must face up; source shells remain separate objects.
for ident in expected:
 node=nodes['Source_'+ident+'_roof']
 for primitive in j['meshes'][node['mesh']]['primitives']:
  normals=read_accessor(primitive['attributes']['NORMAL'])
  assert normals and all(n[1] > .999 for n in normals), ident
print('PASS: all five source roof normals point up.')
