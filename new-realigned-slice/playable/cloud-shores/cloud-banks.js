import * as T from '../../../game/vendor/three.module.js';
export function createCloudBanks(scene,texture,config){
 const group=new T.Group();group.name='World_space_cloud_shores';texture.colorSpace=T.SRGBColorSpace;
 for(const b of config.banks){const m=new T.MeshBasicMaterial({map:texture,color:config.tint??0xffffff,transparent:true,opacity:b.opacity,depthWrite:false,depthTest:true,side:T.DoubleSide,fog:true,toneMapped:false});const o=new T.Mesh(new T.PlaneGeometry(...b.size),m);o.name=b.name;o.position.fromArray(b.position);o.rotation.y=b.yaw;o.castShadow=o.receiveShadow=false;group.add(o);}
 scene.add(group);let disposed=false;return{group,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const o of group.children){o.geometry.dispose();o.material.dispose();}}};
}
