import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const out={};
for(const file of fs.readdirSync('.next/server/app',{recursive:true}).filter(p=>p.endsWith('page_client-reference-manifest.js'))){
 const ctx={};vm.runInNewContext(fs.readFileSync('.next/server/app/'+file,'utf8'),ctx);
 for(const [route,m] of Object.entries(ctx.__RSC_MANIFEST)){
 const chunks=[...new Set(Object.values(m.clientModules).flatMap(v=>v.chunks).filter(p=>typeof p==='string'&&p.endsWith('.js')))];
 out[route]={bytes:0,gzipBytes:0};for(const p of chunks){const b=fs.readFileSync('.next/'+decodeURIComponent(p));out[route].bytes+=b.length;out[route].gzipBytes+=gzipSync(b).length;}
 }
}
fs.writeFileSync(`qa/CLEANUP-2026-10-14/code-bundle-${process.argv[2]}.json`,JSON.stringify(out,null,2));
