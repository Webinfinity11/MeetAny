// Read-only reference inventory: candidates require manual review (framework exports,
// dynamic CSS prefixes and Header h() are not proof of dead code).
import fs from 'node:fs';
const roots=['app','scripts','qa'];
const files=roots.flatMap(root=>fs.readdirSync(root,{recursive:true}).map(p=>`${root}/${p}`)).filter(p=>/\.(?:tsx?|[cm]?js)$/.test(p));
const texts=files.map(p=>[p,fs.readFileSync(p,'utf8')]);
const counts=new Map();for(const [,t] of texts)for(const w of t.matchAll(/\b[A-Za-z_$][\w$]*\b/g))counts.set(w[0],(counts.get(w[0])||0)+1);
const candidates=texts.filter(([p])=>p.startsWith('app/')).flatMap(([p,t])=>[...t.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)].filter(m=>counts.get(m[1])===1).map(m=>({path:p,name:m[1]})));
const pkg=JSON.parse(fs.readFileSync('package.json'));
const dependencies=Object.keys({...pkg.dependencies,...pkg.devDependencies}).map(name=>({name,files:texts.filter(([,t])=>t.includes(`'${name}'`)||t.includes(`"${name}"`)||t.includes(`'${name}/`)||t.includes(`"${name}/`)).map(([p])=>p),implicit:/^@types\//.test(name)||['next','react','eslint','eslint-config-next','typescript'].includes(name)}));
console.log(JSON.stringify({candidates,dependencies},null,2));
