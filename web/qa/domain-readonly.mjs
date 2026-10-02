// Actual browser sign-in and existing-data reads on the canonical production domain.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readRPCs } from './visual/lib/browser.mjs';

const origin = 'https://www.meetany.ge';
const ledger = JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const output = `qa/shots/domain-readonly-${Date.now()}`;
fs.mkdirSync(output, { recursive: true });
const report = { origin, pass: false, checks: 0, errors: [], blockedWrites: [], roles: [] };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const reads = new Set([...readRPCs, 'admin_business_audit', 'admin_registration_analytics']);
const check = (value, label) => { assert(value, label); report.checks++; };
try {
  for (const [role, key] of [['admin', 'owner_admin'], ['company', 'wood'], ['client', 'hotel']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
    await context.route('**/api/**', route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(url.origin, origin);
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
      const rpc = url.pathname.match(/^\/api\/db\/rpc\/([^/]+)$/)?.[1];
      if (rpc && reads.has(rpc) && !rpc.startsWith('mark_')) return route.continue();
      if (url.pathname === '/api/analytics/registration') return route.fulfill({ status: 202, json: { enabled: false } });
      report.blockedWrites.push({ role, path: url.pathname });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push({ role, error: error.message }));
    await page.goto(`${origin}/account/`, { waitUntil: 'domcontentloaded' });
    const account = ledger.accounts[key];
    await page.locator('#login-email').fill(account.email || `demo-${key}@meetany.ge`);
    await page.locator('#login-password').fill(account.password);
    const authResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/auth/sign-in/email'));
    await page.locator('form').filter({ has: page.locator('#login-email') }).getByRole('button', { name: 'შესვლა', exact: true }).click();
    check((await authResponse).status() === 200, `${role}: actual browser sign-in accepted`);
    const trigger = page.getByRole('button', { name: role === 'admin' ? 'ადმინი' : 'პროფილი', exact: true });
    await trigger.waitFor();
    check(page.url().startsWith(origin), `${role}: stays on canonical domain`);
    check(await page.locator('#login-password').count() === 0, `${role}: sign-in completes`);
    if (role === 'admin') {
      await page.goto(`${origin}/admin/?tab=companies`, { waitUntil: 'domcontentloaded' });
      await page.locator('tbody tr').first().waitFor();
      check(await page.getByRole('link', { name: 'პაკეტის განაცხადები', exact: true }).isVisible(), 'Company page exposes activation applications');
      await page.locator('tbody tr').first().getByRole('button', { name: 'დეტალები', exact: true }).click();
      const dialog = page.locator('dialog[open]');
      const select = dialog.getByLabel('პაკეტი', { exact: true });
      await select.waitFor({ state: 'attached' });
      await select.locator('xpath=ancestor::details').locator('summary').click();
      await select.waitFor();
      check(JSON.stringify(await select.locator('option').allTextContents()) === JSON.stringify(['უფასო', 'Premium', 'VIP']), 'Free/Premium/VIP available');
      await page.keyboard.press('Escape');
    } else {
      check((await trigger.boundingBox()).width === 44, `${role}: compact avatar`);
      check(await trigger.locator('.ma-menu__label').count() === 0, `${role}: no visible profile label`);
      await trigger.click();
      check(await page.locator('#ma-account-menu .ma-menu__identity').isVisible(), `${role}: account identity in menu`);
      await page.keyboard.press('Escape');
      if (role === 'company') {
        await page.goto(`${origin}/account/?tab=profile`, { waitUntil: 'domcontentloaded' });
        const field = page.getByRole('button', { name: 'მომსახურების ქალაქები', exact: true });
        await field.waitFor();
        const initial = await field.innerText();
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 950 });
          await field.click();
          const panel = page.getByRole('dialog', { name: 'მომსახურების ქალაქები', exact: true });
          await panel.waitFor();
          check(await panel.locator('input[type=checkbox]').count() === 8, `Cities include Georgia at ${width}`);
          check(await panel.evaluate(el => el.clientHeight <= 241 && el.scrollHeight > el.clientHeight), `Bounded scroll list at ${width}`);
          await panel.getByLabel('მთელი საქართველო', { exact: true }).check();
          check(await panel.locator('input:checked').count() === 1, `Georgia exclusive at ${width}`);
          await panel.getByLabel('თბილისი', { exact: true }).check();
          check(!await panel.getByLabel('მთელი საქართველო', { exact: true }).isChecked(), `City replaces Georgia at ${width}`);
          await page.keyboard.press('Escape');
          check(await field.getAttribute('aria-expanded') === 'false', `Keyboard dismissal at ${width}`);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}`);
          await page.screenshot({ path: `${output}/company-profile-${width}.png` });
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await field.waitFor();
        check(await field.innerText() === initial, 'Unsaved selections do not change stored profile');
        await page.locator('.profile-location-map .leaflet-tile-loaded').first().waitFor();
        check((await page.locator('.profile-location-map .leaflet-control-attribution').innerText()).includes('OpenStreetMap'), 'Map tiles and attribution load');
      } else {
        await page.goto(`${origin}/account/?tab=requests`, { waitUntil: 'domcontentloaded' });
        await page.locator('.account-row__link').first().waitFor();
        check(await page.locator('.account-row__link').count() > 0, 'Client request reads work');
      }
    }
    report.roles.push(role);
    console.log(`PASS ${role}: actual browser sign-in and canonical-domain workspace`);
    await context.close();
  }
  check(report.errors.length === 0, 'No runtime errors');
  check(report.blockedWrites.length === 0, 'No application writes attempted');
  report.pass = true;
} catch (error) {
  report.errors.push({ error: error.message.split('\n')[0] });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, report: `${output}/report.json` }, null, 2));
  await browser.close();
}
