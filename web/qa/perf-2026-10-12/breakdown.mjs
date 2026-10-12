import { chromium } from 'playwright';
const [origin, path] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await c.newPage();
const reqs = []; p.on('request', r => reqs.push({ t: r.resourceType(), u: r.url() }));
await p.goto(origin + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
const by = {}; for (const r of reqs) { const k = r.u.includes('_rsc=') ? 'rsc-prefetch' : r.t; by[k] = (by[k] || 0) + 1; }
console.log(path, reqs.length, JSON.stringify(by));
for (const r of reqs.filter(r => r.t === 'fetch' || r.u.includes('_rsc=')).slice(0, 12)) console.log('  ', r.u.replace(origin, '').slice(0, 110));
await b.close();
