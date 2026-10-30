import json, struct, pathlib, math, sys
D=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[3]/"public/assets/campuses/yingxi"
b=(D/'mechanical-hall.glb').read_bytes(); magic,version,size=struct.unpack_from('<4sII',b);assert (magic,version,size)==(b'glTF',2,len(b))
length,kind=struct.unpack_from('<II',b,12);assert kind==0x4e4f534a
j=json.loads(b[20:20+length]);binlen,bintype=struct.unpack_from('<II',b,20+length);assert bintype==0x004e4942;binary=b[28+length:28+length+binlen]
assert len(binary)==binlen and not j.get('images') and len(j.get('buffers',[]))==1 and 'uri' not in j['buffers'][0]
assert all(not set(n)&{'translation','rotation','scale','matrix'} for n in j['nodes'])
m=json.loads((D/'mechanical-hall.metadata.json').read_text());
def floats(accessor):
 a=j['accessors'][accessor];v=j['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3'; start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);return [struct.unpack_from('<3f',binary,start+i*stride) for i in range(a['count'])]
positions=[];triangles=0
for mesh in j['meshes']:
 for p in mesh['primitives']:
  positions+=floats(p['attributes']['POSITION']);triangles+=j['accessors'][p['indices']]['count']//3
bounds=[[min(x[k] for x in positions),max(x[k] for x in positions)] for k in range(3)]
assert 14.94 <= bounds[1][1] <= 15 and abs(bounds[1][0])<1e-6
stone=floats(j['meshes'][0]['primitives'][0]['attributes']['POSITION'])
for x,z in m['source_polygon']:
 assert any(abs(p[0]-(x-m['centerX']))<1e-4 and abs(p[1])<1e-4 and abs(p[2]-(z-m['centerZ']))<1e-4 for p in stone),(x,z)
assert len(b)<1_000_000 and triangles==m['triangles_authoring'] and len(b)==m['glb_bytes']
m['glb_bounds_local_m']={'xEast':bounds[0],'yUp':bounds[1],'zSouth':bounds[2]};m['glb_triangles']=triangles;m['validation']='GLB 2.0 binary and mesh accessors parsed; all 25 source polygon base vertices match in meter coordinates, no external buffers or images; see verify.py. Bounds include superficial trim.'
(D/'mechanical-hall.metadata.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('PASS GLB 2.0; self-contained; no images; 25 polygon base vertices; no node transforms; triangles',triangles,'bytes',len(b),'bounds',bounds)
