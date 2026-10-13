// Home page load: the qa/perf-2026-10-12/measure.mjs method (cold context, median of N runs) plus CLS and bytes.
// Run from web/ against `next start`:  node qa/home-v2-2026-10-13/measure.mjs --origin http://127.0.0.1:3320 --out qa/home-v2-2026-10-13/before.json
// Profiles: mobile 390×844, Lighthouse throttling (150 ms RTT, 1.6 Mbps, 4× CPU); desktop 1440×900, no throttling.
import fs from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin').replace(/\/+$/, ''), out = arg('out'), runs = Number(arg('runs', 5));
const profiles = {
  mobile: { viewport: { width: 390, height: 844 }, mobile: true, net: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 }, cpu: 4 },
  desktop: { viewport: { width: 1440, height: 900 }, mobile: false, net: null, cpu: 1 },
};
const BUSY = '[aria-busy="true"],.ma-loading__panel,.ma-skel';
const initScript = `(() => {
  window.__lcp = 0; window.__lcpEl = ''; window.__cls = 0; window.__readyAt = null;
  new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__lcp = e.startTime; const el = e.element; window.__lcpEl = el ? el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '') + (el.currentSrc ? ' ' + el.currentSrc.split('?')[0].split('/').pop() : '') : ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  const busy = () => !document.body || document.querySelector(${JSON.stringify(BUSY)}) || (document.querySelector('main')||document.body).innerText.includes('იტვირთება');
  const tick = () => { if (busy()) window.__readyAt = null; else if (window.__readyAt === null) window.__readyAt = performance.now(); };
  setInterval(tick, 20); document.addEventListener('DOMContentLoaded', tick);
})();`;
const median = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

async function measure(browser, p) {
  const context = await browser.newContext({ viewport: p.viewport, isMobile: p.mobile, hasTouch: p.mobile, deviceScaleFactor: p.mobile ? 3 : 1, serviceWorkers: 'block' });
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (p.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.net.latency, downloadThroughput: p.net.down, uploadThroughput: p.net.up });
  if (p.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  // Bytes on the wire for everything the first screen loads (no scrolling).
  let bytes = 0, imgBytes = 0, jsBytes = 0; const types = new Map();
  cdp.on('Network.responseReceived', e => types.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; const t = types.get(e.requestId); if (t === 'Image') imgBytes += e.encodedDataLength; if (t === 'Script') jsBytes += e.encodedDataLength; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let count = 0, inflight = 0, quietSince = Date.now();
  page.on('request', () => { count++; inflight++; }); page.on('requestfinished', () => { inflight--; quietSince = Date.now(); }); page.on('requestfailed', () => { inflight--; quietSince = Date.now(); });
  await page.goto(origin + '/', { waitUntil: 'load', timeout: 90000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const ready = await page.evaluate(() => window.__readyAt);
    if (ready !== null && inflight <= 0 && Date.now() - quietSince > 1500) break;
    await page.waitForTimeout(100);
  }
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    return { ttfb: Math.round(nav.responseStart), fcp: fcp && Math.round(fcp), lcp: Math.round(window.__lcp) || null, lcpEl: window.__lcpEl,
      cls: +window.__cls.toFixed(4), ready: window.__readyAt && Math.round(window.__readyAt), load: Math.round(nav.loadEventEnd), htmlKB: +((nav.encodedBodySize || 0) / 1024).toFixed(1),
      overflow: document.documentElement.scrollWidth - innerWidth };
  });
  await context.close();
  return { ...m, requests: count, totalKB: +(bytes / 1024).toFixed(1), imgKB: +(imgBytes / 1024).toFixed(1), jsKB: +(jsBytes / 1024).toFixed(1), errors };
}

const browser = await chromium.launch();
const result = { origin, at: new Date().toISOString(), runs, profiles: {} };
try {
  for (const [name, p] of Object.entries(profiles)) {
    await measure(browser, p); // warm the server (snapshot cache, route compile) — not counted
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(await measure(browser, p));
    const pick = f => median(samples.map(s => s[f]));
    const row = { ttfb: pick('ttfb'), fcp: pick('fcp'), lcp: pick('lcp'), cls: pick('cls'), ready: pick('ready'), load: pick('load'), requests: pick('requests'),
      totalKB: pick('totalKB'), imgKB: pick('imgKB'), jsKB: pick('jsKB'), htmlKB: pick('htmlKB'), overflow: Math.max(...samples.map(s => s.overflow)),
      lcpEl: samples.at(-1).lcpEl, errors: [...new Set(samples.flatMap(s => s.errors))], samples };
    result.profiles[name] = row;
    console.log(`${name.padEnd(8)} fcp ${row.fcp} lcp ${row.lcp} (${row.lcpEl}) cls ${row.cls} ready ${row.ready} req ${row.requests} total ${row.totalKB}KB img ${row.imgKB}KB js ${row.jsKB}KB overflow ${row.overflow} errors ${row.errors.length}`);
  }
} finally { await browser.close(); }
fs.writeFileSync(out, JSON.stringify(result, null, 1));
