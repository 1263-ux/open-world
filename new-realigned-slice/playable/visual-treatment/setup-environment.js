import * as T from '../../../game/vendor/three.module.js';
import {applyVisualTreatment} from './visual-treatment.js';
const hdriUrl=new URL('../../../asset-recovery/hdri-study/hdri-preview.png',import.meta.url).href;
const skyUrl=new URL('../../../game/assets/sky-night.png',import.meta.url).href;
const configUrl=new URL('./treatment.json',import.meta.url).href;
// Complete all loading before mutating scene. No late HDRI callback can replace the sky.
export async function setupVisualEnvironment(scene,{loadTexture=url=>new T.TextureLoader().loadAsync(url),loadConfig=async url=>{const r=await fetch(url);if(!r.ok)throw Error('视觉配置未读取');return r.json();}}={}){
 const [environment,sky,config]=await Promise.all([loadTexture(hdriUrl),loadTexture(skyUrl),loadConfig(configUrl)]);
 const before={environment:scene.environment,intensity:scene.environmentIntensity};
 environment.colorSpace=T.SRGBColorSpace;environment.mapping=T.EquirectangularReflectionMapping;scene.environment=environment;scene.environmentIntensity=.25;
 const treatment=applyVisualTreatment(scene,config,{skyTexture:sky});let disposed=false;
 return {treatment,dispose(){if(disposed)return;disposed=true;treatment.dispose();scene.environment=before.environment;scene.environmentIntensity=before.intensity;environment.dispose();sky.dispose();}};
}
