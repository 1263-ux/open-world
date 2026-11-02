/* global process, console */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
if(!process.argv[2] || !process.argv[3]) throw Error('Usage: node check.mjs <source> <work-dir>');
const root=path.resolve(process.argv[2]), work=path.resolve(process.argv[3]), stage=path.join(work,'snapshot'), out=path.join(work,'out');
const req=createRequire(path.join(root,'package.json')), {init,parse}=await import(pathToFileURL(req.resolve('es-module-lexer')).href);
const espree=req('espree'), scopes=req('eslint-scope'); await init;
for(const name of ['campus','hks']) {
  const js=fs.readFileSync(path.join(out,name,'bundle.js'),'utf8'); new vm.Script(js);
  const [imports,exports]=parse(js); if(imports.length||exports.length) throw Error(`${name} contains ESM`);
  if(/\bprocess\s*(?:\.\s*env|\[\s*['"]env['"]\s*\])/.test(js)) throw Error(`${name} contains unresolved process.env`);
  // Identify actual free identifiers, not occurrences in strings/comments or locally bound names.
  const ast=espree.parse(js,{ecmaVersion:'latest',sourceType:'script',range:true});
  const free=scopes.analyze(ast,{ecmaVersion:2022,sourceType:'script'}).globalScope.through.filter(r=>r.identifier.name==='process');
  // Phaser's browser-safe, node-only OS detection checks typeof before any use; fail closed on changes.
  const guarded=/if \(typeof process !== "undefined" && process\.versions && process\.versions\.node\) \{\s*OS\.node = true;\s*\}\s*if \(OS\.node && typeof process\.versions === "object"\) \{\s*OS\.nodeWebkit = !!process\.versions\["node-webkit"\];\s*OS\.electron = !!process\.versions\.electron;\s*\}/.exec(js);
  if(free.length && (name!=='hks' || !guarded || !/node:\s*false/.test(js) || (js.match(/\bOS\.node\s*=/g)||[]).length!==1 || free.length!==6 || free.some(r=>r.identifier.range[0]<guarded.index || r.identifier.range[1]>guarded.index+guarded[0].length))) throw Error(`${name} contains unreviewed unbound process identifiers`);
  console.log(`${name}: classic JS parses, no import/export or unresolved process.env; ${free.length} reviewed guarded process references`);
}
const html=fs.readFileSync(path.join(out,'campus-offline.html'),'utf8');
if(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|api\.openai\.com/i.test(html)) throw Error('Unexpected credential/API marker in output');
if(!html.includes('window.__HKS_OFFLINE_HTML__=')||/<script\b[^>]*\bsrc\s*=/i.test(html)||/<link\b[^>]*\bhref\s*=/i.test(html)) throw Error('External HTML resource reference');
const style=fs.readFileSync(path.join(out,'campus',fs.readdirSync(path.join(out,'campus')).find(n=>n.endsWith('.css'))),'utf8'); if(/url\s*\(/i.test(style))throw Error('Unreviewed CSS URL');
const hj=fs.readFileSync(path.join(out,'hks/bundle.js'),'utf8'), cj=fs.readFileSync(path.join(out,'campus/bundle.js'),'utf8');
function verifyHksImages(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { verifyHksImages(full); continue; }
    const bytes = fs.readFileSync(full).toString('base64');
    if (!hj.includes(bytes)) throw Error('Missing embedded Hks image ' + full);
  }
}
verifyHksImages(path.join(stage, 'games/hks/public/assets'));
const hashes=JSON.parse(fs.readFileSync(path.join(out,'source-fingerprints.json'),'utf8')).hashes;
const glbs=Object.keys(hashes).filter(x=>(x.startsWith('public/assets/')||x==='public/models/nature/campus-nature.glb')&&x.endsWith('.glb'));
for(const f of glbs){const b=fs.readFileSync(path.join(stage,f)).toString('base64'); if(!cj.includes(b)) throw Error('Missing embedded GLB: '+f); console.log('Verified embedded GLB:',f);}
// Every copied PNG must be the reviewed Huyu texture and must be embedded.
const pngs=Object.keys(hashes).filter(x=>x.startsWith('public/assets/')&&x.endsWith('.png'));
if (JSON.stringify(pngs.sort()) !== JSON.stringify(['public/assets/environment/Leaves_NormalTree_C.png'])) throw Error('Unexpected/missing environment PNG set');
for (const f of pngs) if (!cj.includes(fs.readFileSync(path.join(stage,f)).toString('base64'))) throw Error('Missing embedded environment PNG: '+f);
for (const f of ['public/assets/environment/quaternius-license-standard.txt','public/assets/exhibits/paperplane-station.metadata.json']) {
  if (!hashes[f] || !fs.readFileSync(path.join(stage,f),'utf8').trim()) throw Error('Missing required asset provenance/notice: '+f);
}
const natureFiles = Object.keys(hashes).filter(x=>x.startsWith('public/models/')).sort();
const approvedNature = ['public/models/nature/License.txt','public/models/nature/PROVENANCE.json','public/models/nature/README.md','public/models/nature/campus-nature.glb'].sort();
if(JSON.stringify(natureFiles)!==JSON.stringify(approvedNature))throw Error('Unexpected/missing nature subset inputs');
if(!fs.readFileSync(path.join(stage,'public/models/nature/License.txt'),'utf8').includes('CC0'))throw Error('Missing nature CC0 notice');
console.log('Verified embedded approved Huyu leaves and retained station/foliage provenance');
for(const f of ['src/scene/LandmarkModels.ts','games/hks/src/GameScene.ts']){const s=fs.readFileSync(path.join(stage,f),'utf8'); if(/['"`]assets\/[^'"`]+\.(?:glb|png|jpe?g)/.test(s)) throw Error('Unresolved local asset in '+f);}
function auditSource(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name); if(e.isDirectory()){auditSource(p);continue;}
    if(!/\.(?:ts|vue|js)$/.test(e.name))continue;
    const s=fs.readFileSync(p,'utf8');
    if(/assets\//.test(s)||/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(s)) throw Error('Unreviewed runtime source URL/network API in '+p);
  }
}
auditSource(path.join(stage,'src')); auditSource(path.join(stage,'games/hks/src'));
console.log('HTML has inline scripts/styles only; All Hks image bytes embedded; CSS contains no URL; app source has no unresolved asset paths or direct network calls.');
console.log('This is static inspection, not file:// play, network interception, or visual QA.');
