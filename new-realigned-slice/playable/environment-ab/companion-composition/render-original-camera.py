import bpy,math,json
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(D/'candidate.blend'));s=bpy.context.scene
cv=lambda p:Vector((p[0],-p[2],p[1]));yaw=.35;zoom=4.1
s.camera.location=cv((2+math.sin(yaw)*zoom,1.8,-13.1+math.cos(yaw)*zoom));s.camera.rotation_euler=(cv((2,1,-13.1))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=36/(2*math.tan(math.radians(48)/2)*(1000/700))
bowl=bpy.data.objects['Mesh_40'];inv=bowl.matrix_world.inverted();vs=[]
for n in ['Mesh_41','Mesh_42','Mesh_43']:
 o=bpy.data.objects[n];vs.extend(inv@o.matrix_world@v.co for v in o.data.vertices)
(D/'fish-envelope.json').write_text(json.dumps({'maxRadius':max(v.length for v in vs),'sphereRadius':.26,'maxYThree':max(v.z for v in vs),'waterYRelative':.12,'singlePosedSample':True},indent=2))
s.render.filepath=str(D/'F2-original-exploration-camera.png');bpy.ops.render.render(write_still=True)
