// Opt-in reversible spatial lighting. No assets, geometry, collisions or player state changed.
import * as T from '../../../game/vendor/three.module.js';
export function applyVisualTreatment(scene,config,{skyTexture=null}={}){
 if(scene.userData.spatialLightTreatment)return scene.userData.spatialLightTreatment;
 const previousBackground=scene.background,previousIntensity=scene.backgroundIntensity,previousFog=scene.fog,lights=[],materials=[];
 scene.traverse(o=>{if(o.isLight)lights.push([o,o.visible]);});
 for(const [o] of lights)o.visible=false;
 const root=new T.Group();root.name='spatial-light-treatment';
 const hemi=new T.HemisphereLight(config.hemisphere.sky,config.hemisphere.ground,config.hemisphere.intensity);root.add(hemi);
 const moon=new T.DirectionalLight(config.moon.color,config.moon.intensity);moon.position.fromArray(config.moon.position);root.add(moon);
 for(const p of config.warm){const light=new T.SpotLight(config.warmColor,p.intensity,p.distance,p.angle,.8,2);light.name=p.name;light.position.fromArray(p.position);light.target.position.fromArray(p.target);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.0005;root.add(light,light.target);}
 scene.traverse(o=>{if(!o.isMesh)return;const old=o.material;let changed=false;const replace=m=>{if(!m.name.startsWith(config.glazing.prefix))return m;const n=m.clone();n.emissive.set(config.glazing.color);n.emissiveIntensity=config.glazing.emissiveIntensity;n.opacity=Math.max(n.opacity,config.glazing.minimumOpacity);changed=true;return n;};const next=Array.isArray(old)?old.map(replace):replace(old);if(changed){materials.push([o,old,next]);o.material=next;}});
 if(skyTexture){skyTexture.colorSpace=T.SRGBColorSpace;skyTexture.mapping=T.EquirectangularReflectionMapping;scene.background=skyTexture;scene.backgroundIntensity=config.sky.intensity;}
 scene.add(root);scene.fog=new T.Fog(config.fog.color,config.fog.near,config.fog.far);
 let disposed=false;const api={root,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const [o,old,next] of materials){o.material=old;for(const m of (Array.isArray(next)?next:[next]))if(!(Array.isArray(old)?old:[old]).includes(m))m.dispose();}root.traverse(o=>{if(o.isLight)o.dispose?.();});for(const [o,v] of lights)o.visible=v;scene.fog=previousFog;scene.background=previousBackground;scene.backgroundIntensity=previousIntensity;delete scene.userData.spatialLightTreatment;}};scene.userData.spatialLightTreatment=api;return api;
}
