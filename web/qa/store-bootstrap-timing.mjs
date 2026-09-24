// P12 T12.5b: client store bootstrap — time to networkidle and the /api/db + Neon Auth call waterfall.
// Run: QA_ORIGIN=http://localhost:3001 node qa/store-bootstrap-timing.mjs [label]   (read-only; never prints secrets)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const label = process.argv[2] || 'run';
const RUNS = 3;
const browser = await chromium.launch({ headless: true, executablePath });
const errors = [];

function track(p) {
  const calls = [];
  const name = u => u.pathname.startsWith('/api/db/') ? u.pathname.slice(8) + (u.pathname.endsWith('/profiles') ? '' : '') : u.pathname.includes('/auth/') ? 'auth' + u.pathname.slice(u.pathname.indexOf('/auth/') + 5) : null;
  p.on('request', r => { const n = name(new URL(r.url())); if (n) calls.push({ n, r, start: Date.now(), end: null }); });
  p.on('requestfinished', r => { const c = calls.find(x => x.r === r); if (c) c.end = Date.now(); });
  p.on('requestfailed', r => { const c = calls.find(x => x.r === r); if (c) c.end = Date.now(); });
  return calls;
}
async function measure(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  const calls = track(p);
  const t0 = Date.now();
  await p.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
  const idle = Date.now() - t0 - 500; // networkidle = 500 ms with no requests
  await p.close();
  const lastEnd = Math.max(0, ...calls.map(c => (c.end || c.start) - t0));
  return { idle, lastEnd, calls: calls.map(c => ({ n: c.n.replace(/^profiles.*/, 'profiles'), s: c.start - t0, e: (c.end || c.start) - t0 })) };
}
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const out = {};
try {
  for (const url of ['/requests/', '/companies/']) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) { const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); runs.push(await measure(ctx, url)); await ctx.close(); }
    out['guest ' + url] = runs;
  }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(base + '/account/', { waitUntil: 'networkidle' });
  await p.locator('#login-email').fill('demo-hotel@meetany.ge');
  await p.locator('#login-password').fill(ledger.accounts.hotel.password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('#login-email'), null, { timeout: 60000 });
  await p.close();
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(ctx, '/account/'));
  out['client /account/'] = runs;
  await ctx.close();
  const summary = {};
  for (const [k, runs] of Object.entries(out)) {
    const last = runs[runs.length - 1];
    summary[k] = { networkidleMs: runs.map(r => r.idle), median: median(runs.map(r => r.idle)), lastCallEndMs: median(runs.map(r => r.lastEnd)), calls: last.calls.length, waterfall: last.calls.map(c => `${c.n} ${c.s}→${c.e}`) };
    console.log(`\n${k}: networkidle median ${summary[k].median} ms (${summary[k].networkidleMs.join(', ')}), last call end ${summary[k].lastCallEndMs} ms, ${summary[k].calls} calls`);
    for (const w of summary[k].waterfall) console.log('   ' + w);
  }
  fs.writeFileSync(path.join(root, `qa/store-bootstrap-${label}.json`), JSON.stringify(summary, null, 1));
  assert.equal(errors.length, 0, 'pageerror: ' + errors.join(' | '));
} catch (err) {
  console.error(String(err.message || err).replaceAll(/demo-\w+@/g, 'demo-*@'));
  process.exitCode = 1;
} finally { await browser.close(); }
