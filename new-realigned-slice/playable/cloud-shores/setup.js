import * as T from '../../../game/vendor/three.module.js';
import {createCloudBanks} from './cloud-banks.js';
export const CLOUD_CONFIG_URL=new URL('./config.json',import.meta.url).href;
export const CLOUD_TEXTURE_URL=new URL('./cloud-bank-generated-v1.png',import.meta.url).href;
const active=new WeakMap();
// Return a lifecycle handle immediately; optional art must not block game startup.
export function setupCloudShores(scene,{loadTexture=url=>new T.TextureLoader().loadAsync(url),loadConfig=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Cloud shore configuration unavailable');return r.json();},onError=e=>console.warn('Optional cloud shores unavailable:',e)}={}){
 if(active.has(scene))return active.get(scene);
 let disposed=false,texture=null,layer=null;
 const handle={ready:null,get group(){return layer?.group??null;},dispose(){if(disposed)return;disposed=true;layer?.dispose();texture?.dispose();texture=null;active.delete(scene);}};
 active.set(scene,handle);
 handle.ready=Promise.allSettled([Promise.resolve().then(()=>loadTexture(CLOUD_TEXTURE_URL)),Promise.resolve().then(()=>loadConfig(CLOUD_CONFIG_URL))]).then(results=>{
  if(results[0].status==='fulfilled')texture=results[0].value;
  if(disposed){texture?.dispose();texture=null;return null;}
  const failed=results.find(r=>r.status==='rejected');
  try{if(failed)throw failed.reason;const config=results[1].value;if(!Array.isArray(config.banks)||config.banks.length>4)throw Error('Invalid cloud bank budget');layer=createCloudBanks(scene,texture,config);return layer.group;}
  catch(e){texture?.dispose();texture=null;try{onError(e);}catch{}return null;}
 });
 return handle;
}
