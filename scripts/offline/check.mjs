/* global process, console */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
if(!process.argv[2] || !process.argv[3]) throw Error('Usage: node check.mjs <source> <work-dir>');
const root=path.resolve(process.argv[2]), work=path.resolve(process.argv[3]), stage=path.join(work,'snapshot'), out=path.join(work,'out');
const req=createRequire(path.join(root,'package.json')), {init,parse}=await import(pathToFileURL(req.resolve('es-module-lexer')).href); await init;
for(const name of ['campus','hks']) {const js=fs.readFileSync(path.join(out,name,'bundle.js'),'utf8'); new vm.Script(js); const [imports,exports]=parse(js); if(imports.length||exports.length) throw Error(`${name} contains ESM`); console.log(`${name}: classic JS parses, no import/export`);}
const html=fs.readFileSync(path.join(out,'campus-offline.html'),'utf8');
if(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|api\.openai\.com/i.test(html)) throw Error('Unexpected credential/API marker in output');
if(!html.includes('window.__HKS_OFFLINE_HTML__=')||/<script\b[^>]*\bsrc\s*=/i.test(html)||/<link\b[^>]*\bhref\s*=/i.test(html)) throw Error('External HTML resource reference');
const style=fs.readFileSync(path.join(out,'campus',fs.readdirSync(path.join(out,'campus')).find(n=>n.endsWith('.css'))),'utf8'); if(/url\s*\(/i.test(style))throw Error('Unreviewed CSS URL');
const hj=fs.readFileSync(path.join(out,'hks/bundle.js'),'utf8'), cj=fs.readFileSync(path.join(out,'campus/bundle.js'),'utf8');
for(const f of fs.readdirSync(path.join(stage,'games/hks/public/assets'))) {const b=fs.readFileSync(path.join(stage,'games/hks/public/assets',f)).toString('base64'); if(!hj.includes(b))throw Error('Missing asset '+f);}
const hashes=JSON.parse(fs.readFileSync(path.join(out,'source-fingerprints.json'),'utf8')).hashes;
const glbs=Object.keys(hashes).filter(x=>x.startsWith('public/assets/')&&x.endsWith('.glb'));
for(const f of glbs){const b=fs.readFileSync(path.join(stage,f)).toString('base64'); if(!cj.includes(b)) throw Error('Missing embedded GLB: '+f); console.log('Verified embedded GLB:',f);}
for(const f of ['src/scene/LandmarkModels.ts','games/hks/src/GameScene.ts']){const s=fs.readFileSync(path.join(stage,f),'utf8'); if(/['"`]assets\/[^'"`]+\.(?:glb|png)/.test(s)) throw Error('Unresolved local asset in '+f);}
function auditSource(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name); if(e.isDirectory()){auditSource(p);continue;}
    if(!/\.(?:ts|vue|js)$/.test(e.name))continue;
    const s=fs.readFileSync(p,'utf8');
    if(/assets\//.test(s)||/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(s)) throw Error('Unreviewed runtime source URL/network API in '+p);
  }
}
auditSource(path.join(stage,'src')); auditSource(path.join(stage,'games/hks/src'));
console.log('HTML has inline scripts/styles only; PNG bytes embedded; CSS contains no URL; app source has no unresolved asset paths or direct network calls.');
console.log('This is static inspection, not file:// play, network interception, or visual QA.');
