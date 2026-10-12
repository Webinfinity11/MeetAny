// Markdown tables from measure.mjs results.
//   node qa/perf-2026-10-12/table.mjs before-local-guest.json [after-local-guest.json]
// One file: per page/profile metrics. Two files: before → after for the key metrics.
import fs from 'node:fs';
const dir = 'qa/perf-2026-10-12/';
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f.includes('/') ? f : dir + f, 'utf8')));
const ms = v => v == null ? '—' : v >= 1000 ? (v / 1000).toFixed(2) + ' s' : v + ' ms';
const kb = v => v == null ? '—' : v + ' KB';
if (!b) {
  console.log('| page | profile | TTFB | FCP | LCP | ready | requests | JS (transfer) | images | /api calls |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [k, p] of Object.entries(a.pages)) {
    const [page] = k.split('/');
    console.log(`| ${page} | ${p.profile} | ${ms(p.ttfb)} | ${ms(p.fcp)} | ${ms(p.lcp)} | ${ms(p.ready)} | ${p.requests} | ${kb(p.jsTransferKB)} / ${p.jsFiles} | ${p.imgFiles} / ${kb(p.imgKB)} | ${p.api.filter(x => x.url.startsWith('/api/')).length} |`);
  }
} else {
  const arrow = (x, y, f) => `${f(x)} → **${f(y)}**`;
  console.log('| page | profile | LCP | ready | requests | /api calls | JS (transfer) |');
  console.log('|---|---|---:|---:|---:|---:|---:|');
  for (const [k, p] of Object.entries(a.pages)) {
    const q = b.pages[k]; if (!q) continue;
    const api = r => r.api.filter(x => x.url.startsWith('/api/')).length;
    console.log(`| ${k.split('/')[0]} | ${p.profile} | ${arrow(p.lcp, q.lcp, ms)} | ${arrow(p.ready, q.ready, ms)} | ${p.requests} → ${q.requests} | ${api(p)} → ${api(q)} | ${kb(p.jsTransferKB)} → ${kb(q.jsTransferKB)} |`);
  }
}
