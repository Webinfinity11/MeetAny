// Page weight by resource type at a 390 px phone viewport, cross-origin included (CDP sizes),
// after scrolling once to the bottom so lazy images count too. Read-only.
//   node qa/perf-2026-10-12/weight.mjs <origin> <out.json> <path>...
import fs from 'node:fs';
import { chromium } from 'playwright';
const [origin, out, ...paths] = process.argv.slice(2);
const b = await chromium.launch();
const result = {};
for (const path of paths) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const p = await c.newPage();
  const sizes = []; p.on('requestfinished', r => sizes.push(r.sizes().then(s => [r.resourceType(), s.responseBodySize + s.responseHeadersSize]).catch(() => null)));
  await p.goto(origin + path, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(1000);
  const by = {};
  for (const [t, n] of (await Promise.all(sizes)).filter(Boolean)) by[t] = (by[t] || 0) + n;
  result[path] = Object.fromEntries(Object.entries(by).map(([t, n]) => [t, Math.round(n / 1024)]));
  console.log(path.padEnd(60), JSON.stringify(result[path]));
  await c.close();
}
await b.close();
fs.writeFileSync(out, JSON.stringify(result, null, 1));
