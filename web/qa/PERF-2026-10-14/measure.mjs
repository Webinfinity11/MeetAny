import fs from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const tag = process.argv[2] || 'before';
const out = new URL('./', import.meta.url);
const origin = 'http://localhost:3420';
const storageState = process.env.PERF_STORAGE_STATE;
const role = storageState ? 'signed-in' : 'guest';
if (storageState && !Array.isArray(JSON.parse(fs.readFileSync(storageState, 'utf8')).cookies)) throw new Error('Invalid storageState');
const routes = {
  request: '/requests/view/?id=26b44585-e6d4-4d3c-b359-532d0fb1f4d2',
  company: '/companies/view/?id=1877f069-837f-49fa-b4c6-91b79de45601',
};
const busy = '[aria-busy="true"],.ma-loading__panel,.ma-skel,.account-loading-shell,.request-form__skeleton';
// Traces must never retain session response headers or bearer tokens.
const traceJson = value => JSON.stringify(value, (key, item) => /headers|cookie|token|password|authorization|jwt/i.test(key) ? '[REDACTED]' : typeof item === 'string' ? item.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]') : item);
const result = { tag, origin, role, samples: [] };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const [route, path] of Object.entries(routes)) {
    for (let run = 0; run < 3; run++) {
      const load = os.loadavg();
      if (load[0] >= 4) throw new Error(`Measurement blocked: load ${load[0]} >= 4`);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...(storageState ? { storageState } : {}) });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const events = [];
      cdp.on('Tracing.dataCollected', e => events.push(...e.value));
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing,loading', transferMode: 'ReportEvents' });
      const bootstrap = page.waitForResponse(r => r.url().includes('/api/db/bootstrap'));
      const start = performance.now();
      await page.goto(origin + path, { waitUntil: 'commit' });
      await page.locator('main h1').waitFor({ state: 'visible' });
      await page.waitForFunction(selector => !document.querySelector(selector), busy);
      const ready = Math.round(performance.now() - start);
      if (storageState) { const data = await (await bootstrap).json(); if (!data.me?.id) throw new Error('Expected signed-in profile'); result.profileRole = data.me.role; } else bootstrap.catch(() => {});
      const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ url: r.name.replace(location.origin, ''), start: r.startTime, end: r.responseEnd, bytes: r.encodedBodySize, decoded: r.decodedBodySize })));
      const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      await completed;
      fs.writeFileSync(new URL(`${tag}-${route}-${run}.trace.json.gz`, out), gzipSync(traceJson({ traceEvents: events })));
      result.samples.push({ route, run, load, ready, resources });
      console.log(JSON.stringify({ route, run, load: load[0], ready }));
      await context.close();
    }
  }
} finally {
  fs.writeFileSync(new URL(`${tag}.json`, out), JSON.stringify(result, null, 2));
  await browser.close();
}
