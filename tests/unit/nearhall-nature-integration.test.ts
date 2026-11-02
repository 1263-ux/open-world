import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { createFoliageGeometry, getFoliageVariation } from '../../src/scene/SurfaceStyle';
import { NEAR_HALL_NATURE_PLACEMENTS, nearHallTreeClearsProtectedPaths } from '../../src/scene/CampusScene';
import * as THREE from 'three';
import { createCampusNatureAssets, type NatureKind } from '../../src/scene/CampusNatureAssets';
import { PHOTO_POINTS } from '../../src/games/photography';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';
import { campuses } from '../../src/campus-data/campuses';
import { ElementDouble } from './controller-harness';
import { ARRIVAL_ROUTES } from '../../src/scene/CampusArrivalLandscape';
let player:PlayerController;
beforeEach(()=>{vi.stubGlobal('Element',ElementDouble);vi.stubGlobal('document',Object.assign(new EventTarget(),{createElement:()=>new ElementDouble()}));vi.stubGlobal('window',new EventTarget());vi.spyOn(performance,'now').mockReturnValue(0);vi.spyOn(StudentModel,'load').mockReturnValue(new Promise(()=>{}));player=new PlayerController(new ElementDouble() as unknown as HTMLElement,new ElementDouble() as unknown as HTMLCanvasElement);});
afterEach(()=>{player.dispose();vi.restoreAllMocks();vi.unstubAllGlobals();});
function sources() {
  const bytes = readFileSync(new URL('../../public/models/nature/campus-nature.glb',import.meta.url));
  const jsonLength = bytes.readUInt32LE(12), j = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const geometries = {} as Record<NatureKind, THREE.BufferGeometry>;
  for (const mesh of j.meshes) {
    const geometry = new THREE.BufferGeometry(), primitive = mesh.primitives[0];
    for (const [attribute, id] of Object.entries({ ...primitive.attributes, INDEX: primitive.indices })) {
      const a = j.accessors[id as number], view = j.bufferViews[a.bufferView];
      const count = ({ SCALAR: 1, VEC2: 2, VEC3: 3 } as Record<string, number>)[a.type]!;
      const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
      const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength), values: number[] = [];
      for (let i = 0; i < a.count; i++) for (let c = 0; c < count; c++) {
        const offset = view.byteOffset + (a.byteOffset ?? 0) + i * (view.byteStride ?? count * size) + c * size;
        values.push(a.componentType === 5126 ? data.getFloat32(offset, true) : size === 4 ? data.getUint32(offset, true) : data.getUint16(offset, true));
      }
      if (attribute === 'INDEX') geometry.setIndex(values);
      else geometry.setAttribute(({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' } as Record<string, string>)[attribute]!, new THREE.Float32BufferAttribute(values, count));
    }
    geometries[mesh.name as NatureKind] = geometry;
  }
  return { geometries, bytes, json: j };
}

it('retains real GLB route clearance and both positive/negative near-hall photo candidates',()=>{
 const {geometries,json}=sources();expect(json.materials).toHaveLength(1);expect(json.materials[0].alphaMode ?? 'OPAQUE').toBe('OPAQUE');const lib=createCampusNatureAssets(geometries,new THREE.MeshStandardMaterial());
 const admitted=NEAR_HALL_NATURE_PLACEMENTS.filter(placement=>{const candidate=lib.createBatch([placement]);const clear=nearHallTreeClearsProtectedPaths(candidate.colliders,campuses.yingxi);candidate.dispose();return clear;});
 const batch=lib.createBatch(admitted);
 const retained=NEAR_HALL_NATURE_PLACEMENTS.filter(p=>!admitted.includes(p));
 for(const p of retained){const [x,,z]=p.position, index=NEAR_HALL_NATURE_PLACEMENTS.indexOf(p),variation=getFoliageVariation(x,z);
 const crown=new THREE.Mesh(createFoliageGeometry(variation.variant),new THREE.MeshStandardMaterial({side:THREE.DoubleSide}));crown.position.set(x,4.2+(index%3)*.18,z);crown.rotation.y=variation.yaw;crown.scale.set(2.1,2.4,2.1);batch.visual.add(crown);
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,3.4,8),new THREE.MeshStandardMaterial());trunk.position.set(x,1.7,z);batch.visual.add(trunk);
 const solid=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,3.4,8),new THREE.MeshBasicMaterial());solid.position.set(x,1.7,z);batch.colliders.add(solid);}

 batch.visual.traverse(object=>{if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){expect(material.transparent).toBe(false);expect(material.opacity).toBe(1);expect(material.alphaTest).toBe(0);}}});
 player.setCampus(campuses.yingxi,batch.colliders);player.resize(1280,660);batch.visual.updateMatrixWorld(true);
 const c=player as unknown as {yaw:number;pitch:number};const point=PHOTO_POINTS[0]!,result=[];const raycaster=new THREE.Raycaster();
 for(const z of [175.5,170.5,169,172,174,173.726,173.996])for(const pitch of [-.15,-.2,-.25,-.3,-.35,-.4,-.45,-.5,-.55,-.6]){
  player.setPosition([-20,z]);for(let i=0;i<3;i++)player.update(1/60);c.yaw=Math.atan2(point.target[0]+20,point.target[2]-z);c.pitch=pitch;player.updateCamera(true);player.camera.updateMatrixWorld(true);
  const fits=(xyz:number[],mx:number,my:number)=>{const p=new THREE.Vector3(...xyz).project(player.camera);return p.z>=-1&&p.z<=1&&Math.abs(p.x)<=mx&&Math.abs(p.y)<=my;};
  const framed=fits(point.target,.45,.5)&&point.focusExtent.every(p=>fits(p,.45,.5))&&point.frameExtent.every(p=>fits(p,.95,.95));let obstructed=false;
  if(framed)for(const xyz of [point.target,...point.focusExtent]){const delta=new THREE.Vector3(...xyz).sub(player.camera.position);raycaster.set(player.camera.position,delta.clone().normalize());raycaster.far=delta.length()-.2;if(raycaster.intersectObject(batch.visual,true).length){obstructed=true;break;}}
  result.push({z,pitch,framed,obstructed,camera:player.camera.position.toArray()});
 }
 expect(admitted.map(p=>p.id)).toEqual([0,1,2,4].map(i=>`near-hall-tree-${i}`));
 expect(result.find(r=>r.z===175.5&&r.pitch===-.25)).toMatchObject({framed:true,obstructed:false});
 expect(result.find(r=>r.z===170.5&&r.pitch===-.2)).toMatchObject({framed:true,obstructed:true});
 expect(result.find(r=>r.z===169&&r.pitch===-.25)).toMatchObject({framed:true,obstructed:true});
 // Actual captured foreground pose: retained narrow old tree must not clip
 // the normal central camera ray. Frustum artwork remains a separate pixel gate.
 player.setPosition([6.562,172.005]);for(let i=0;i<3;i++)player.update(1/60);c.yaw=.9394;c.pitch=-.15;player.updateCamera(true);
 expect(player.camera.position.distanceTo(new THREE.Vector3(1.773737,1.723371,168.503415))).toBeLessThan(.002);
 // Independent dense samples of the actual committed mixture, not merely a
 // call to the production admission predicate. Ground is excluded from this tree Octree.
 const octree=new Octree().fromGraphNode(batch.colliders);
 for(const route of [...Object.values(campuses.yingxi.routes),ARRIVAL_ROUTES.yingxi])for(let i=1;i<route.length;i++){
   const a=route[i-1]!,b=route[i]!,n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.125);
   for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;
     const hit=octree.capsuleIntersect(new Capsule(new THREE.Vector3(x,.46,z),new THREE.Vector3(x,1.5,z),.34));
     expect(hit?hit.depth:0,`tree path at ${x},${z}`).toBeLessThanOrEqual(.001);
   }
 }
 batch.dispose();lib.dispose();
}, 15000);
