import * as T from '../../../game/vendor/three.module.js';
import {Controller} from '../../../game/controller.js';
import {inside} from '../navigation.js';
import {createLayout,buildSurface} from './surface.js';
const floor=/Continuous stone landing|Slanted threshold landing|Bridge plank|Inset path stone/;
const replaced=/Descending side fragment|Short wing wall/;
const optional=/Column Round|Arch Round RoundColumn|Bush Round|Soft edge leaves|Door remaining pier|Broken destination arch|Bridge rail post|Low continuous bridge rail|Tall left wall remnant|Right shallow return|Near threshold low remnant/;
const collider=/Window lower wall|Tall left wall remnant|Right shallow return|Near threshold low remnant|Door remaining pier|Column Round/;
const effectiveVisible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const active=new WeakMap();
// Purely station geometry/navigation. Does not mutate any bay materials, gates, boats or navigation.
export function installStation({scene,world,threshold,data}){
 if(active.has(world))return active.get(world);
 const layout=createLayout(data),changed=[],hide=o=>{changed.push([o,o.visible]);o.visible=false;};
 world.updateMatrixWorld(true);
 world.traverse(o=>{if(!o.isMesh)return;const name=o.name.replaceAll('_',' ');if(floor.test(name)||replaced.test(name)){hide(o);return;}if(optional.test(name)){const box=new T.Box3().setFromObject(o),c=box.getCenter(new T.Vector3());if(!inside(c.x,c.z,data.walkOutline))hide(o);}});
 // New mesh represents this exact dock/ramp contract; don't retain overlapping old ground.
 for(const o of threshold.ground)hide(o);
 const surface=buildSurface(layout);surface.group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(surface.group);surface.group.updateMatrixWorld(true);
 const colliders=[{x:-3.45,z:-3.85,w:1.5,d:.62,name:'Existing writing table'}];
 world.traverse(o=>{if(!o.isMesh||!effectiveVisible(o)||!collider.test(o.name.replaceAll('_',' ')))return;const box=new T.Box3().setFromObject(o),c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());if(box.min.y<1.5)colliders.push({x:c.x,z:c.z,w:s.x,d:s.z,name:o.name});});
 colliders.push(...data.wallBlocks.map(b=>({x:b.center[0],z:b.center[2],w:b.size[0],d:b.size[2],name:'Window fragment masonry'})));
 const controller=new Controller({x:data.anchors.spawn[0],z:data.anchors.spawn[2],walkable:layout.walkable,colliders});
 let disposed=false;const out={layout,controller,ground:surface.ground,occluders:[world,surface.group],group:surface.group,changed,
 dispose(){if(disposed)return;disposed=true;for(const[o,v]of changed)o.visible=v;scene.remove(surface.group);const materials=new Set();surface.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);}});materials.forEach(m=>m.dispose());active.delete(world);}};
 active.set(world,out);return out;
}
