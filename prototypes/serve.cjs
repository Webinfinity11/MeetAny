const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const roots={prototype:__dirname,dist:path.resolve(__dirname,'../dist')};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
 const proto=pathname.startsWith('/prototypes/'),root=proto?roots.prototype:roots.dist;
 const relative=proto?pathname.slice('/prototypes/'.length):pathname.slice(1);
 const file=path.resolve(root,relative+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)||relative.split('/').includes('v1')||relative.split('/').includes('archive')){res.writeHead(404).end();return}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});fs.createReadStream(file).pipe(res)});
}).listen(4032,'127.0.0.1',()=>console.log('P2 prototypes: http://127.0.0.1:4032/prototypes/t21-requests.html'));
