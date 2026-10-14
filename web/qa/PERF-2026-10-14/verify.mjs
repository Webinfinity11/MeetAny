import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const out = new URL('./', import.meta.url);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
 for (const role of ['guest', 'client']) for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, ...(role === 'client' ? { storageState: fileURLToPath(new URL('.env.client-state.json', out)) } : {}) });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for (const [kind, id] of [['request', '26b44585-e6d4-4d3c-b359-532d0fb1f4d2'], ['company', '1877f069-837f-49fa-b4c6-91b79de45601']]) {
   const bootstrap = page.waitForResponse(r => r.url().includes('/api/db/bootstrap'));
   await page.goto(`http://localhost:3420/${kind === 'request' ? 'requests' : 'companies'}/view/?id=${id}`);
   const response = await bootstrap, payload = await response.json();
   assert.equal(response.status(), 200); assert.equal(!!payload.me, role === 'client');
   await page.locator('main h1').waitFor();
   await page.waitForFunction(() => !document.querySelector('[aria-busy="true"],.ma-loading__panel,.ma-skel'));
   await page.waitForLoadState('networkidle');
   if (kind === 'request') { await page.getByRole('heading', { name: 'მსგავსი მოთხოვნები' }).waitFor(); assert.equal(await page.locator('main [data-request-id]').count(), 3); }
   await page.screenshot({ path: fileURLToPath(new URL(`after-${kind}-${role}-${width}.png`, out)), fullPage: true });
   results.push({ kind, role, width, bootstrap: new URL(response.url()).pathname + new URL(response.url()).search, bytes: (await response.body()).length, requests: payload.requests.length, companies: payload.companies.length, seeded: payload.seeded, errors: [...errors] });
   if (kind === 'company') {
    const product = page.locator('.company-detail-section button').first();
    if (await product.count()) { await product.click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
    const next = page.waitForResponse(r => new URL(r.url()).pathname === '/api/db/bootstrap' && !new URL(r.url()).search);
    await page.locator('main').getByRole('link', { name: 'კომპანიები', exact: true }).click();
    const catalog = await (await next).json(); assert(catalog.companies.length > 1); results.at(-1).catalogCompanies = catalog.companies.length;
   }
  }
  assert.deepEqual(errors, []); await context.close();
 }
} finally { fs.writeFileSync(new URL('verification.json', out), JSON.stringify(results, null, 2)); await browser.close(); }
console.log('Guest/client, 1440/390, product dialog and detail-to-catalog navigation passed');
