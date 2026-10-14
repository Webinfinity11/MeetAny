import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { signedContext, settle } from './measure.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3445';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [], errors = [];
try {
  for (const role of ['company','client']) for (const width of [1440,1024,980,390,360,320]) {
    const context = await signedContext(browser, role, width), page = await context.newPage();
    page.on('pageerror', error => errors.push({ role, width, message: error.message }));
    const paths = ['/account/?tab=overview','/account/?tab=messages','/account/?tab=profile', ...(role === 'company' ? ['legal','documents','products','distribution','security'].map(section => '/account/?tab=profile&section=' + section) : [])];
    for (const path of paths) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await settle(page);
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      results.push({ role, width, path, kind: 'page', overflow });
      if (width === 1440 && path === '/account/?tab=profile') {
        const dimensions = await page.evaluate(() => ({ form: document.querySelector('#profile-basic').getBoundingClientRect().width, panel: document.querySelector('aside[aria-label*="სტატუსი"]').getBoundingClientRect().width }));
        assert.equal(dimensions.form, 640); assert.equal(dimensions.panel, 320);
        results.push({ role, width, path, kind: 'columns', ...dimensions });
      }
      for (const selector of ['header button[aria-controls="ma-account-menu"]','header button[aria-label^="შეტყობინებები"]']) {
        const opener = page.locator(selector).first();
        if (!await opener.isVisible()) continue;
        await opener.click(); await page.waitForTimeout(200);
        const covered = await page.evaluate(() => {
          const open = [...document.querySelectorAll('header [role=menu],header [class*=popover],header [id]')]
            .filter(el => { const r = el.getBoundingClientRect(); return r.height > 40 && r.top >= 0 && getComputedStyle(el).visibility !== 'hidden'; })
            .sort((a,b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
          if (!open) return [];
          const r = open.getBoundingClientRect(), hits = new Set();
          for (let y = r.top + 8; y < Math.min(r.bottom - 4, innerHeight); y += 10) for (let x = Math.max(0,r.left + 8); x < Math.min(r.right - 4,innerWidth); x += 24) {
            const hit = document.elementFromPoint(x,y);
            if (hit && !open.contains(hit) && !hit.closest('header[class*=ma-header]')) hits.add(hit.tagName + '.' + String(hit.className));
          }
          return [...hits];
        });
        results.push({ role, width, path, kind: 'menu', covered });
        await page.keyboard.press('Escape');
      }
      if (width < 1024 && path === '/account/?tab=profile') {
        const details = page.locator('aside[aria-label*="სტატუსი"] details');
        assert.equal(await details.getAttribute('open'), null);
        await details.locator('summary').click(); assert(await details.getAttribute('open') !== null);
        results.push({ role, width, path, kind: 'mobile-panel', passed: true });
      }
      console.log(role, width, path, overflow);
    }
    await context.close();
  }
} catch (error) { errors.push({ message: error.stack }); }
finally { await browser.close(); fs.writeFileSync('qa/LAYOUT-2026-10-14/profile/overlays.json', JSON.stringify({ results, errors }, null, 2)); }
assert.deepEqual(errors, []);
assert(!results.some(row => row.overflow || row.covered?.length));
