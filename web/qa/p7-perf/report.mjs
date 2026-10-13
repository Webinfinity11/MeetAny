import fs from 'node:fs';
const [tag, baseline] = process.argv.slice(2);
let text = `# T7.6 — ${tag}\n\nProduction build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.\n\n`;
text += '| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
for (const role of ['guest','client']) {
 const data=JSON.parse(fs.readFileSync(`qa/p7-perf/${tag}-local-${role}.json`));
 const before=baseline && JSON.parse(fs.readFileSync(`qa/p7-perf/${baseline}-local-${role}.json`));
 for (const [key,row] of Object.entries(data.pages)) {
  const fields=['lcp','ready','requests','api','jsTransferKB','htmlKB'];
  const value=(r,f)=>f==='api'?r.api.filter(a=>a.url.startsWith('/api/')).length:r[f];
  text+=`| ${role} | ${key} | ${fields.map(f=>before?`${value(before.pages[key],f)} → ${value(row,f)}`:value(row,f)).join(' | ')} | ${row.errors.length} |\n`;
 }
}
fs.writeFileSync(`qa/p7-perf/${tag}.md`,text);
