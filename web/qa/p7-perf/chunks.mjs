import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const result={};
for(const [kind,route] of [['request','requests'],['company','companies']]) {
 const context={}; vm.runInNewContext(fs.readFileSync(`.next/server/app/(${kind}-view)/${route}/view/page_client-reference-manifest.js`,'utf8'),context);
 const manifest=Object.values(context.__RSC_MANIFEST)[0];
 const paths=[...new Set(Object.values(manifest.clientModules).flatMap(m=>m.chunks).filter(p=>typeof p==='string'&&p.endsWith('.js')))];
 const chunks=paths.map(p=>{const b=fs.readFileSync('.next/'+p);return {path:p,bytes:b.length,gzipBytes:gzipSync(b).length};});
 result[kind]={bytes:chunks.reduce((s,c)=>s+c.bytes,0),gzipBytes:chunks.reduce((s,c)=>s+c.gzipBytes,0),chunks};
}
fs.writeFileSync(`qa/p7-perf/${process.argv[2]}-chunks.json`,JSON.stringify(result,null,2));
