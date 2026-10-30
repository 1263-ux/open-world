/* global process, console, Buffer */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import vm from 'node:vm';

if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node build.mjs <frozen-source> <external-work-dir>');
const src=fs.realpathSync(process.argv[2]);
const work=fs.realpathSync(process.argv[3]), stage=path.join(work,'snapshot'), out=path.join(work,'out');
if(work===src || work.startsWith(src+path.sep)) throw Error('Work directory must be outside source tree');
const marker=path.join(work,'.campus-offline-builder');
if(fs.existsSync(marker)) {
  if(fs.readFileSync(marker,'utf8')!=='campus-offline-builder-v1\n') throw Error('Work marker invalid');
} else {
  if(fs.readdirSync(work).length) throw Error('Work directory must be empty or previously initialized by this builder');
  fs.writeFileSync(marker,'campus-offline-builder-v1\n');
}
fs.rmSync(stage,{recursive:true,force:true}); fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(stage,{recursive:true}); fs.mkdirSync(out,{recursive:true});
const cp=(rel)=>{ const from=path.join(src,rel), to=path.join(stage,rel); fs.mkdirSync(path.dirname(to),{recursive:true}); fs.cpSync(from,to,{recursive:true}); };
for(const rel of ['index.html','package.json','package-lock.json','games/hks/index.html','games/hks/package.json','games/hks/package-lock.json','games/hks/MODIFICATIONS.md','games/hks/MODERNIZATION.md','games/hks/ASSET_INVENTORY.json','games/hks/SOURCE_INVENTORY.json','games/hks/MODERNIZED_INVENTORY.json','games/hks/PHASER-LICENSE.md',
'public/data/README.md','public/data/augmentation-huyu-audit.json','public/data/augmentation-yingxi-audit.json','public/data/campus-spatial.json','public/data/osm-source.geojson','public/data/sources/README.md','public/data/sources/manifest.json','public/data/sources/tyut-globfp-huyu.geojson','public/data/sources/tyut-globfp-yingxi.geojson','public/data/sources/tyut-overture-huyu.geojson','public/data/sources/tyut-overture-yingxi.geojson']) cp(rel);
function copyApproved(dir,allow) {
  for(const e of fs.readdirSync(path.join(src,dir),{withFileTypes:true})) {
    if(e.name.startsWith('.') || e.isSymbolicLink()) throw Error('Unexpected hidden or symlink input: '+path.join(dir,e.name));
    const rel=path.join(dir,e.name);
    if(e.isDirectory()) copyApproved(rel,allow);
    else if(e.isFile() && allow(e.name)) cp(rel);
    else throw Error('Unapproved input: '+rel);
  }
}
copyApproved('src', n=>/\.(?:ts|vue|css|json)$/.test(n));
copyApproved('games/hks/src',n=>/\.ts$/.test(n));
copyApproved('games/hks/public/assets',n=>/\.(?:png|jpe?g)$/.test(n));
copyApproved('public/assets',n=>/\.glb$|\.metadata\.json$|^NOTO-CJK-COPYRIGHT\.txt$/.test(n));
fs.symlinkSync(path.join(src,'node_modules'),path.join(stage,'node_modules'),'dir');
fs.symlinkSync(path.join(src,'games/hks/node_modules'),path.join(stage,'games/hks/node_modules'),'dir');
const hashes={};
function fingerprint(dir, prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue; const rel=path.join(prefix,e.name), p=path.join(dir,e.name); if(e.isDirectory())fingerprint(p,rel); else hashes[rel]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
fingerprint(stage);
const edit=(rel,fn)=>{const p=path.join(stage,rel), old=fs.readFileSync(p,'utf8'), next=fn(old); if(old===next)throw Error('Adapter did not match '+rel); fs.writeFileSync(p,next);};
if(!fs.readFileSync(path.join(stage,'src/components/HksOverlay.vue'),'utf8').includes('__HKS_OFFLINE_HTML__')) edit('src/components/HksOverlay.vue',s=>s.replace(':src="gameUrl"',':src="offlineHtml ? undefined : gameUrl"\n        :srcdoc="offlineHtml"').replace('const gameUrl =',"const offlineHtml = import.meta.env.VITE_OFFLINE_BUILD === 'true' ? (window as Window & { __HKS_OFFLINE_HTML__?: string }).__HKS_OFFLINE_HTML__ : undefined\nconst gameUrl ="));
if(!fs.readFileSync(path.join(stage,'games/hks/src/main.ts'),'utf8').includes("location.origin === 'null' ? '*' : location.origin")) edit('games/hks/src/main.ts',s=>s.replace('window.parent.postMessage({ type }, location.origin)',"window.parent.postMessage({ type }, location.origin === 'null' ? '*' : location.origin)"));
const data=(p,mime)=>`data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
// Embed the complete upstream asset tree, including nested effects and menu JPG.
const hksAssets = new Set();
function embedHksImages(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { embedHksImages(full); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    const code = fs.readFileSync(full, 'utf8').replace(/(['"])assets\/([^'"\n]+\.(?:png|jpe?g))\1/g, (_, quote, rel) => {
      const root = path.resolve(stage, 'games/hks/public/assets');
      const asset = path.resolve(root, rel);
      if (!asset.startsWith(root + path.sep) || !fs.existsSync(asset)) throw Error('Missing/unsafe Hks image ' + rel);
      hksAssets.add(rel);
      return JSON.stringify(data(asset, /\.png$/.test(rel) ? 'image/png' : 'image/jpeg'));
    });
    fs.writeFileSync(full, code);
  }
}
embedHksImages(path.join(stage, 'games/hks/src'));
if (!hksAssets.size) throw Error('No Hks images embedded');
console.log('Embedded Hks images:', hksAssets.size);
// Registry URLs are deliberately explicit; do not silently ship a missing model.
const modelSource=path.join(stage,'src/scene/LandmarkModels.ts');
let modelCode=fs.readFileSync(modelSource,'utf8');
const baseDecl="const base = `${import.meta.env.BASE_URL}assets/campuses/`;";
if(!modelCode.includes(baseDecl)) throw Error('Unknown model registry base; review the adapter');
const models=[];
modelCode=modelCode.replace(/`\$\{base\}([^`$]+\.glb)`/g, (_,rel)=>{
  const full=path.resolve(stage,'public/assets/campuses',rel);
  if(!full.startsWith(path.resolve(stage,'public/assets/campuses')+path.sep) || !fs.existsSync(full)) throw Error('Missing/unsafe model '+rel);
  // A GLB may itself refer to external buffers or images. Reject these rather than network at runtime.
  const bytes=fs.readFileSync(full);
  if(bytes.readUInt32LE(0)!==0x46546c67 || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length || bytes.readUInt32LE(16)!==0x4e4f534a) throw Error('Invalid GLB '+rel);
  const length=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+length).toString('utf8').trim());
  for(const entry of [...(json.buffers||[]),...(json.images||[])]) if(entry.uri && !entry.uri.startsWith('data:')) throw Error('External GLB resource '+rel);
  models.push(rel); return JSON.stringify(data(full,'model/gltf-binary'));
});
modelCode=modelCode.replace(baseDecl,'');
if(/\.glb(?:["'`]|\b)/i.test(modelCode)) throw Error('Unresolved model reference');
const listed=[];
function listModels(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),rel=path.join(prefix,e.name);if(e.isDirectory())listModels(p,rel);else if(e.name.endsWith('.glb'))listed.push(rel);}}
listModels(path.join(stage,'public/assets/campuses'));
if(models.length!==new Set(models).size || JSON.stringify([...models].sort())!==JSON.stringify(listed.sort())) throw Error('Registry and public GLB set differ; review assets');
if(!models.length)throw Error('No models embedded');
fs.writeFileSync(modelSource,modelCode);
console.log('Embedded GLBs:',models.join(', '));
const rootReq=createRequire(path.join(src,'package.json')); 
const vite8=await import(pathToFileURL(rootReq.resolve('vite')).href), vite5=await import(pathToFileURL(path.join(src,'games/hks/node_modules/vite/dist/node/index.js')).href), vue=(await import(pathToFileURL(rootReq.resolve('@vitejs/plugin-vue')).href)).default;
const buildOne=async(vite,root,entry,output,plugins=[])=>vite.build({configFile:false,root,publicDir:false,cacheDir:path.join(work,'cache',output),plugins,define:{'import.meta.env.VITE_OFFLINE_BUILD':JSON.stringify('true'),'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:path.join(out,output),emptyOutDir:true,target:'es2020',minify:false,cssCodeSplit:false,lib:{entry:path.join(root,entry),name:output==='hks'?'HksOffline':'CampusOffline',formats:['iife'],fileName:()=> 'bundle.js'},rollupOptions:{output:{inlineDynamicImports:true}}}});
await buildOne(vite5,path.join(stage,'games/hks'),'src/main.ts','hks');
await buildOne(vite8,stage,'src/main.ts','campus',[vue()]);
const read=(p)=>fs.readFileSync(p,'utf8'), safeJs=s=>s.replace(/<\/script/gi,'<\\/script');
const hj=read(path.join(out,'hks/bundle.js')), cj=read(path.join(out,'campus/bundle.js'));
new vm.Script(hj); new vm.Script(cj);
// Escaping for an inline HTML script must preserve classic JavaScript syntax.
new vm.Script(safeJs(hj)); new vm.Script(safeJs(cj));
const hindex=read(path.join(stage,'games/hks/index.html')).replace(/<script type="module" src="\/src\/main\.ts"><\/script>/,`<script>${safeJs(hj)}</script>`);
if(hindex.includes('src/main.ts'))throw Error('Hks HTML injection failed');
const cssFiles=fs.readdirSync(path.join(out,'campus')).filter(n=>n.endsWith('.css')); if(cssFiles.length!==1)throw Error('Expected one CSS output: '+cssFiles);
const css=read(path.join(out,'campus',cssFiles[0]));
let html=read(path.join(stage,'index.html')).replace('</head>',`<style>${css.replace(/<\/style/gi,'<\\/style')}</style></head>`).replace(/<script type="module" src="\/src\/main\.ts"><\/script>/,`<script>window.__HKS_OFFLINE_HTML__=${JSON.stringify(hindex).replace(/</g,'\\u003c')};</script><script>${safeJs(cj)}</script>`);
if(!html.includes('window.__HKS_OFFLINE_HTML__='))throw Error('Campus HTML injection failed');
fs.writeFileSync(path.join(out,'campus-offline.html'),html);
fs.writeFileSync(path.join(out,'source-fingerprints.json'),JSON.stringify({algorithm:'sha256', sourceSnapshot:path.basename(src), models, hashes},null,2));
console.log('HTML bytes',Buffer.byteLength(html),'source files',Object.keys(hashes).length);
