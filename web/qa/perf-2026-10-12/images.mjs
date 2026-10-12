// Lists images a page loads with their byte size and rendered size (read-only).
import { chromium } from 'playwright';
const [origin, path, width = '1366'] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: +width, height: 900 } }); const p = await c.newPage();
await p.goto(origin + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
const rows = await p.evaluate(() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'img' || r.initiatorType === 'css' && /\.(png|jpe?g|webp|avif)/.test(r.name)).map(r => {
  const el = [...document.images].find(i => i.currentSrc === r.name);
  return { url: r.name.replace(location.origin, '').slice(-70), kb: Math.round((r.encodedBodySize || r.transferSize) / 1024), natural: el ? `${el.naturalWidth}x${el.naturalHeight}` : '', shown: el ? `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}` : '' };
}));
let total = 0; for (const r of rows) { total += r.kb; console.log(String(r.kb).padStart(6), 'KB', r.natural.padEnd(10), '→', r.shown.padEnd(9), r.url); }
console.log('total', total, 'KB in', rows.length, 'images');
await b.close();
