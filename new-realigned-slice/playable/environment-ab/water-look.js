import * as T from '../../../game/vendor/three.module.js';
export const CONFIG=Object.freeze({roughness:.16,metalness:0,surfaceTint:0x719cad,environmentIntensity:.55,backgroundIntensity:.7,amplitudeA:.012,amplitudeB:.006});
export function waveHeight(x,z,time=0){return CONFIG.amplitudeA*Math.sin(.9*x+1.4*z-time*.28)+CONFIG.amplitudeB*Math.sin(2.1*x-.6*z+time*.19);}
// An isolated runtime candidate. Does not mutate boat, shore, collision, or chapter state.
export function applyWaterLook(scene,root,texture){
 const waters=[];root.traverse(o=>{if(o.isMesh&&o.name==='Shallow_water_fading_edge_not_plinth')waters.push(o);});
 if(!waters.length)throw Error('Expected real threshold water mesh');
 for(const o of waters){o.geometry=o.geometry.clone();const index=o.geometry.index,normals=o.geometry.attributes.normal;let down=0;if(normals)for(let i=0;i<normals.count;i++)down+=normals.getY(i);if(index&&down<0){for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}index.needsUpdate=true;}o.material=o.material.clone();o.material.color.setHex(CONFIG.surfaceTint);o.material.roughness=CONFIG.roughness;o.material.metalness=CONFIG.metalness;o.material.envMapIntensity=1;o.userData.waterBaseline=Float32Array.from(o.geometry.attributes.position.array);}
 if(texture){texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;scene.background=texture;scene.environment=texture;scene.backgroundIntensity=CONFIG.backgroundIntensity;scene.environmentIntensity=CONFIG.environmentIntensity;}
 function update(time=0){for(const o of waters){const p=o.geometry.attributes.position,b=o.userData.waterBaseline;for(let i=0;i<p.count;i++)p.setY(i,b[i*3+1]+waveHeight(b[i*3],b[i*3+2],time));p.needsUpdate=true;o.geometry.computeVertexNormals();}}
 update(0);return{waters,update};
}
