"""Compare triangle geometry by material, ignoring exporter vertex/index order.
Usage: python compare_geometry.py original.glb regenerated.glb
"""
import json,struct,collections,sys

def parse(path):
 b=open(path,'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:]
 def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];count={'VEC3':3,'SCALAR':1}[a['type']];fmt='<'+fmt*count;step=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,binary,start+k*step) for k in range(a['count'])]
 result=collections.defaultdict(collections.Counter)
 materials={m['name']:m for m in j['materials']}
 for mesh in j['meshes']:
  for p in mesh['primitives']:
   name=j['materials'][p['material']]['name'];pos=acc(p['attributes']['POSITION']);nor=acc(p['attributes']['NORMAL']);idx=[x[0] for x in acc(p['indices'])]
   for i in range(0,len(idx),3):
    corners=[(tuple(round(x,5) for x in pos[k]),tuple(round(x,5) for x in nor[k])) for k in idx[i:i+3]];tri=min(tuple(corners[n:]+corners[:n]) for n in range(3));result[name][tri]+=1
 return dict(result),materials
(a,am),(b,bm)=map(parse,sys.argv[1:3]);assert a.keys()==b.keys();assert am==bm, 'Material properties differ'
for k in a:
 assert a[k]==b[k],f'{k}: {sum((a[k]-b[k]).values())} original-only, {sum((b[k]-a[k]).values())} rebuilt-only triangles'
print('PASS identical material properties and oriented position/normal triangles at 1e-5 tolerance (unordered); GLB byte hash may differ')
