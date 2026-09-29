import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readRPCs } from './visual/lib/browser.mjs';

const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'qa/shots/cleanup-2026-09-29');
fs.mkdirSync(path.join(dir, phase), { recursive: true });
const origin = process.env.QA_ORIGIN || 'http://localhost:3003';
assert.equal(new URL(origin).hostname, 'localhost');
assert.equal(new URL(origin).port, '3003');
const baseline = phase === 'after' ? JSON.parse(fs.readFileSync(path.join(dir, 'before.json'))) : null;
const result = { phase, origin, companyRoute: baseline?.companyRoute, captures: [], errors: [], blocked: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', timezoneId: 'Asia/Tbilisi', reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
    const rpc = url.pathname.match(/^\/api\/db\/rpc\/([^/]+)$/)?.[1];
    if (url.origin === origin && rpc && readRPCs.has(rpc) && rpc !== 'mark_read') return route.continue();
    result.blocked.push({ method: request.method(), path: url.pathname });
    await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(origin + '/companies/', { waitUntil: 'networkidle' });
  await page.locator('.card-main-link').first().waitFor();
  result.companyRoute ||= await page.locator('.card-main-link').first().getAttribute('href');
  const routes = [
    ['home', '/'], ['companies', '/companies/'], ['requests', '/requests/'],
    ['company', result.companyRoute],
    ['request', '/requests/view/?id=fb2d9c2f-acef-4cde-be59-f1686aaf14ad'],
    ['account', '/account/'], ['new-request', '/requests/new/'], ['admin-guest', '/admin/'],
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [name, route] of routes) {
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'));
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 60)); }
        scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      await page.waitForTimeout(200);
      assert.equal(await page.locator('h2[role="alert"]').count(), 0, 'Unavailable page is not a baseline');
      const info = await page.evaluate(() => ({ title: document.querySelector('h1')?.textContent, text: document.querySelector('main').innerText, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
      const textHash = createHash('sha256').update(info.text).digest('hex');
      const key = name + '-' + width;
      const bytes = await page.screenshot({ path: path.join(dir, phase, key + '.png'), fullPage: true, animations: 'disabled', caret: 'hide' });
      const row = { key, route, title: info.title, textHash, width: info.width, height: info.height };
      if (phase === 'after') {
        const a = PNG.sync.read(fs.readFileSync(path.join(dir, 'before', key + '.png'))), b = PNG.sync.read(bytes);
        row.sameDimensions = a.width === b.width && a.height === b.height;
        row.sameText = baseline.captures.find(c => c.key === key).textHash === textHash;
        if (row.sameDimensions) {
          const diff = new PNG({ width: a.width, height: a.height });
          row.changedPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, includeAA: true });
          if (row.changedPixels) fs.writeFileSync(path.join(dir, key + '-diff.png'), PNG.sync.write(diff));
        } else row.changedPixels = null;
      }
      result.captures.push(row);
      console.log(key + (phase === 'after' ? ': pixels=' + row.changedPixels + ', sameText=' + row.sameText : ': captured'));
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(dir, phase + '.json'), JSON.stringify(result, null, 2) + '\n');
}
assert.equal(result.blocked.length, 0, 'Unexpected write blocked');
assert.equal(result.errors.length, 0, 'Browser errors');
assert.equal(result.captures.length, 16);
if (phase === 'after') assert(result.captures.every(c => c.sameDimensions && c.changedPixels === 0), 'Visual differences require review');
