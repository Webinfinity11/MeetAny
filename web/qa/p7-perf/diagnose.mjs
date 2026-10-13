// Page-load measurements (read-only: only GET navigations and the app's own reads).
// Run from web/:
//   node qa/perf-2026-10-12/measure.mjs --origin https://www.meetany.ge --out live.json \
//     --request <id> --company <id> [--runs 3] [--auth http://127.0.0.1:3012 --user <uuid>]
// --auth points at auth-fixture.mjs (local only): Auth calls are answered in the browser with a
// locally signed JWT for --user, so nothing reaches the real Neon Auth.
// Per page and profile: TTFB, FCP, LCP, "ready" (no skeleton / aria-busy / "იტვირთება" left),
// request count, JS transferred/decoded, /api/db waterfall.
import fs from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin').replace(/\/+$/, ''), out = arg('out'), runs = Number(arg('runs', 3));
const auth = arg('auth'), user = arg('user');
const only = arg('pages') ? arg('pages').split(',') : null;
const pages = [
  ['home', '/'],
  ['requests', '/requests/'],
  ['request-view', `/requests/view/?id=${arg('request')}`],
  ['companies', '/companies/'],
  ['company-view', `/companies/view/?id=${arg('company')}`],
  ...(auth ? [['account', '/account/']] : []),
].filter(([k]) => !only || only.includes(k));
// Lighthouse "mobile": 150 ms RTT, 1.6 Mbps down, 750 kbps up, 4x CPU.
const profiles = { desktop: null, mobile: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8, cpu: 4 } };

const BUSY = '[aria-busy="true"],.ma-loading__panel,.ma-skel,.account-loading-shell,.request-form__skeleton,.companies-map__loading';
const initScript = `(() => {
  window.__lcp = 0; window.__readyAt = null; window.__longTasks=[]; window.__lcpNode=null; new PerformanceObserver(l=>{for(const e of l.getEntries())window.__longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
  new PerformanceObserver(l => { for (const e of l.getEntries()) {window.__lcp = e.startTime;window.__lcpNode={tag:e.element?.tagName,class:e.element?.className,text:e.element?.textContent?.slice(0,120),url:e.url};} }).observe({ type: 'largest-contentful-paint', buffered: true });
  const busy = () => !document.body || document.querySelector(${JSON.stringify(BUSY)}) || (document.querySelector('main')||document.body).innerText.includes('იტვირთება');
  const tick = () => { if (busy()) window.__readyAt = null; else if (window.__readyAt === null) window.__readyAt = performance.now(); };
  setInterval(tick, 20); document.addEventListener('DOMContentLoaded', tick);
})();`;

const median = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

async function token() { return (await (await fetch(`${auth}/__mint?sub=${user}`)).json()).token; }

async function measure(browser, path, profile) {
  const context = await browser.newContext({ viewport: profile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, serviceWorkers: 'block' });
  if (auth) {
    const jwt = user ? await token() : null;
    await context.route(`${auth}/**`, route => {
      const url = route.request().url();
      if (url.includes('/.well-known/')) return route.continue();
      return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? { 'set-auth-jwt': jwt } : {}) },
        json: url.endsWith('/get-session') ? (user ? { user: { id: user, email: 'perf@local.test', name: 'perf' } } : null) : { token: jwt } });
    });
  }
  // A signed-in browser has the store's session hint (meetany.session) from its previous visit.
  if (user) await context.addInitScript(() => { try { localStorage.setItem('meetany.session', '1'); } catch {} });
  await context.addInitScript(initScript);
  const page = await context.newPage();
  if (profile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency, downloadThroughput: profile.down, uploadThroughput: profile.up });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  }
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let count = 0; page.on('request', () => count++);
  await page.goto(origin + path, { waitUntil: 'load', timeout: 90000 });
  // Settle: ready held for 1.5 s with no request in flight, max 30 s.
  const t0 = Date.now(); let inflight = 0, quietSince = Date.now();
  page.on('request', () => { inflight++; }); page.on('requestfinished', () => { inflight--; quietSince = Date.now(); }); page.on('requestfailed', () => { inflight--; quietSince = Date.now(); });
  while (Date.now() - t0 < 30000) {
    const ready = await page.evaluate(() => window.__readyAt);
    if (ready !== null && inflight <= 0 && Date.now() - quietSince > 1500) break;
    await page.waitForTimeout(100);
  }
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const res = performance.getEntriesByType('resource');
    const js = res.filter(r => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name));
    const api = res.filter(r => /\/api\//.test(r.name) || /get-session|\/token/.test(r.name))
      .map(r => ({ url: r.name.replace(location.origin, ''), start: Math.round(r.startTime), end: Math.round(r.responseEnd), ms: Math.round(r.duration), kb: +(r.decodedBodySize / 1024).toFixed(1) }));
    const img = res.filter(r => r.initiatorType === 'img' || /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/.test(r.name));
    return {
      lcpNode: window.__lcpNode, longTasks:window.__longTasks, resources:res.map(r=>({name:r.name.replace(location.origin,''),start:Math.round(r.startTime),end:Math.round(r.responseEnd),transfer:r.transferSize,decoded:r.decodedBodySize})), ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
      fcp: fcp && Math.round(fcp), lcp: Math.round(window.__lcp) || null, ready: window.__readyAt && Math.round(window.__readyAt),
      htmlKB: +((nav.decodedBodySize || 0) / 1024).toFixed(1),
      jsFiles: js.length, jsTransferKB: +(js.reduce((s, r) => s + r.transferSize, 0) / 1024).toFixed(1), jsDecodedKB: +(js.reduce((s, r) => s + r.decodedBodySize, 0) / 1024).toFixed(1),
      imgFiles: img.length, imgKB: +(img.reduce((s, r) => s + (r.encodedBodySize || 0), 0) / 1024).toFixed(1),
      api,
    };
  });
  await context.close();
  return { ...m, requests: count, errors };
}

const browser = await chromium.launch();
const result = { origin, at: new Date().toISOString(), runs, signedIn: !!user, pages: {} };
try {
  for (const [key, path] of pages) for (const [pname, profile] of Object.entries(profiles)) {
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(await measure(browser, path, profile));
    const pick = f => median(samples.map(s => s[f]));
    const row = { path, profile: pname, ttfb: pick('ttfb'), fcp: pick('fcp'), lcp: pick('lcp'), ready: pick('ready'), load: pick('load'),
      requests: pick('requests'), jsFiles: pick('jsFiles'), jsTransferKB: pick('jsTransferKB'), jsDecodedKB: pick('jsDecodedKB'), htmlKB: pick('htmlKB'),
      imgFiles: pick('imgFiles'), imgKB: pick('imgKB'), api: samples[samples.length - 1].api, errors: [...new Set(samples.flatMap(s => s.errors))], samples: samples.map(({ api, ...s }) => s) };
    result.pages[`${key}/${pname}`] = row;
    console.log(`${key.padEnd(13)} ${pname.padEnd(7)} ttfb ${row.ttfb} fcp ${row.fcp} lcp ${row.lcp} ready ${row.ready} req ${row.requests} js ${row.jsTransferKB}KB/${row.jsFiles} api ${row.api.length}`);
  }
} finally { await browser.close(); }
fs.writeFileSync(out, JSON.stringify(result, null, 1));
