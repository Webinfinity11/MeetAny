// Counts the RSC prefetches a page triggers and their response bytes (read-only).
import { chromium } from 'playwright';
const [origin, path] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage();
const rows = []; p.on('requestfinished', async r => { if (!r.url().includes('_rsc=')) return; const s = await r.sizes().catch(() => null); rows.push({ u: r.url().replace(origin, ''), kb: s ? +(s.responseBodySize / 1024).toFixed(1) : 0 }); });
await p.goto(origin + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
console.log(path, 'prefetches', rows.length, 'total KB', rows.reduce((a, r) => a + r.kb, 0).toFixed(1));
for (const r of rows.slice(0, 6)) console.log('  ', r.kb, r.u.slice(0, 90));
await b.close();
