// Local JWT + real RPC checks. Restores the dedicated database after every role.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import pg from 'pg';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://127.0.0.1:3449';
const AUTH = process.env.AUTH || 'http://127.0.0.1:4449';
for (const url of [BASE, AUTH]) assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = 'qa/LAYOUT-2026-10-14/account-primary';
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e' };
const sections = ['details', 'legal', 'documents', 'products', 'distribution', 'security'];
const report = { clean: [], dirty: [], checks: [], axe: [], overlays: [], pageerrors: [], errors: [] };
const pass = message => { report.checks.push(message); console.log('PASS', message); };
const db = new pg.Client({ connectionString: 'postgresql://localhost/meetany_layout_profile' });
await db.connect();
assert.equal((await db.query('select current_database() as name')).rows[0].name, 'meetany_layout_profile');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
// The global header CTA is owned by the parallel header thread and excluded by the task.
const cleanCount = page => page.locator('.ma-btn--primary:visible').evaluateAll(buttons => buttons.filter(button => !(button.closest('header') && !button.closest('main'))).length);
const saveButton = scope => scope.getByRole('button', { name: 'შენახვა', exact: true });
async function settle(page) {
  await page.locator('.account-shell').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('main').innerText.includes('იტვირთება') && ![...document.querySelectorAll('.ma-skel,.ma-loading__panel,[aria-busy="true"]')].some(el => el.getClientRects().length), null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
}
async function go(page, section = 'details') {
  await page.goto(`${BASE}/account/?tab=profile&section=${section}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page);
}
async function audit(page, label) {
  // Variant changes animate background/color; inspect the settled state, not a transition frame.
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  assert.equal(overflow, 0, `${label}: overflow`);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
  report.axe.push({ label, overflow, violations });
  assert.deepEqual(violations, [], `${label}: axe`);
}
async function shot(page, name, width) {
  if (width === 320) return;
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
}
async function saved(scope) {
  await scope.getByRole('status').filter({ hasText: 'შენახულია' }).first().waitFor();
  assert(await saveButton(scope).isDisabled());
  assert.match(await saveButton(scope).getAttribute('class'), /ma-btn--secondary/);
}
async function editSaveReload(page, field, scope, label) {
  const original = await field.inputValue(), changed = `${original} QA`.trim();
  await field.fill(changed);
  assert.equal(await cleanCount(page), 1, `${label}: dirty`);
  report.dirty.push({ label, primary: 1 });
  await saveButton(scope).click(); await saved(scope);
  assert.equal(await cleanCount(page), 0, `${label}: saved`);
  await page.reload(); await settle(page);
  assert.equal(await field.inputValue(), changed, `${label}: persistence`);
  await field.fill(original); await saveButton(scope).click(); await saved(scope);
  pass(`${label}: primary 0 → 1 → 0; real save, feedback, reload persistence, restored`);
}
try {
  for (const role of ['client', 'company']) {
    const original = (await db.query('select * from public.profiles where id=$1', [ids[role]])).rows[0];
    const originalProducts = (await db.query('select items from meetany_private.company_products where company_id=$1', [ids[role]])).rows[0];
    const business = (await db.query('select * from meetany_private.company_business where company_id=$1', [ids[role]])).rows[0];
    const jwt = (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    let passwordCalls = 0;
    await context.route(`${AUTH}/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/.well-known/')) return route.continue();
      const headers = { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Expose-Headers': 'set-auth-jwt', 'set-auth-jwt': jwt };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (path === '/change-password') {
        passwordCalls++;
        assert.equal(route.request().postDataJSON().currentPassword, 'qa-wrong-current-password');
        return route.fulfill({ status: 400, headers, json: { code: 'INVALID_PASSWORD', message: 'Invalid password' } });
      }
      return route.fulfill({ headers, json: path === '/get-session' ? { user: { id: ids[role], email: 'qa@local.test', name: 'QA' } } : { token: jwt } });
    });
    await context.route(/https:\/\/.*\/auth\//, route => route.abort());
    await context.addInitScript(() => { localStorage.setItem('meetany.session', '1'); localStorage.setItem('meetany.theme', 'blue'); });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.pageerrors.push({ role, message: error.message }));
    page.on('dialog', dialog => dialog.accept());
    try {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
        for (const section of sections) {
          await go(page, section);
          assert.equal(await cleanCount(page), 0, `${role}/${section}/${width}: clean`);
          for (const button of await page.getByRole('button', { name: 'შენახვა', exact: true }).all()) {
            if (await button.isVisible()) { assert(await button.isDisabled()); assert.match(await button.getAttribute('class'), /ma-btn--secondary/); }
          }
          report.clean.push({ role, section, width, primary: 0 });
          await audit(page, `${role}/${section}/${width}`);
          if (section === 'details') {
            if (role === 'client') {
              await page.getByRole('button', { name: 'დაამატეთ კომპანიის პროფილი' }).click();
              assert.match(await page.locator('button[form="company-upgrade-form"][type="submit"]').getAttribute('class'), /ma-btn--tint/);
              assert.equal(await page.locator('#company-upgrade aside button').count(), 0);
              assert.equal(await cleanCount(page), 0);
            }
            await shot(page, `${role}-details`, width);
            const basic = page.locator('#profile-basic'), name = page.locator('#name');
            await name.fill(original.name + ' QA');
            assert.equal(await cleanCount(page), 1);
            report.dirty.push({ label: `${role}/details/${width}`, primary: 1 });
            if (role === 'client') await shot(page, 'client-details-dirty', width);
            await audit(page, `${role}/details-dirty/${width}`);
            await saveButton(basic).click(); await saved(basic);
            assert.equal(await cleanCount(page), 0);
            await page.reload(); await settle(page);
            assert.equal(await name.inputValue(), original.name + ' QA');
            await name.fill(original.name); await saveButton(basic).click(); await saved(basic);
            pass(`${role}/${width}: basic real save, feedback, persisted reload, restored`);
          }
          if (role === 'company' && section === 'security') await shot(page, 'company-security', width);
          console.log('CLEAN', role, section, width, 0);
        }
        await go(page, 'security');
        const password = page.locator('#account-password button[type="submit"]');
        assert.match(await password.getAttribute('class'), /ma-btn--secondary/);
        const callsBeforeValidation = passwordCalls;
        await page.locator('#password-new').fill('short'); await password.click();
        await page.locator('#password-current-error').waitFor();
        assert.equal(passwordCalls, callsBeforeValidation);
        await page.locator('#password-current').fill('qa-wrong-current-password');
        await page.locator('#password-new').fill('qa-new-password-123');
        await page.locator('#password-repeat').fill('qa-new-password-123');
        assert.equal(await cleanCount(page), 0);
        await password.click();
        await page.locator('#password-current-error').filter({ hasText: 'მიმდინარე პაროლი არასწორია.' }).waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'password-current');
        assert.match(await password.getAttribute('class'), /ma-btn--secondary/);
        await audit(page, `${role}/password-error/${width}`);
        pass(`${role}/${width}: password secondary submits; INVALID_PASSWORD fixture error and focus`);
        const menuButton = page.locator('header button[aria-controls="ma-account-menu"]');
        if (await menuButton.isVisible()) {
          await menuButton.click();
          const menu = page.locator('#ma-account-menu'); await menu.waitFor();
          const covered = await menu.evaluate(menu => [...menu.querySelectorAll('a,button')].filter(el => {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) return false;
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return !hit || !el.contains(hit);
          }).map(el => el.textContent));
          assert.deepEqual(covered, []); report.overlays.push({role,width,covered});
          await page.keyboard.press('Escape');
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (role === 'company') {
        await go(page, 'legal');
        await editSaveReload(page, page.locator('#legal-contact_position'), page.locator('.account-profile-block').first(), 'company/legal');
        await go(page, 'products');
        const product = page.locator('#product-0-name');
        assert(await product.count(), 'demo company has a product to edit');
        const productForm = page.locator('form').filter({ has: product });
        await editSaveReload(page, product, productForm, 'company/products');
        await go(page, 'distribution');
        const toggle = page.getByRole('switch', { name: 'ვარ დისტრიბუტორი' });
        const previous = await toggle.isChecked();
        await toggle.setChecked(!previous); assert.equal(await cleanCount(page), 1);
        const distributor = page.locator('.account-profile-block').first();
        await saveButton(distributor).click(); await saved(distributor);
        await page.reload(); await settle(page); assert.equal(await toggle.isChecked(), !previous);
        if (!previous) {
          const conditions = page.locator('form.distribution-form');
          await page.locator('#distribution-channels').click();
          await page.getByRole('option').first().click(); await page.keyboard.press('Escape');
          const minimum = conditions.getByLabel('მინიმალური შეკვეთა');
          await minimum.fill('QA 100'); assert.equal(await cleanCount(page), 1);
          await saveButton(conditions).click(); await saved(conditions);
          await page.reload(); await settle(page); assert.equal(await minimum.inputValue(), 'QA 100');
          pass('company/distribution conditions: secondary → primary, saved and persisted');
        }
        await toggle.setChecked(previous); await saveButton(distributor).click(); await saved(distributor);
        pass('company/distribution: dirty status primary, saved and persisted, restored');
        // A verified fixture hides submission; exercise the unverified account-only variant too.
        await db.query('update profiles set verified=false where id=$1', [ids.company]);
        await go(page, 'documents');
        const submitDocs = page.getByRole('button', { name: 'განხილვაზე გაგზავნა', exact: true });
        assert.match(await submitDocs.getAttribute('class'), /ma-btn--secondary/);
        assert.equal(await cleanCount(page), 0);
        await submitDocs.click();
        await page.getByRole('alert').filter({ hasText: 'გაგზავნამდე შეავსეთ' }).waitFor();
        pass('company/documents: unverified secondary submit retains requirements validation');
        await db.query('update profiles set verified=$2 where id=$1', [ids.company, original.verified]);
      } else {
        await go(page);
        await page.getByRole('button', { name: 'დაამატეთ კომპანიის პროფილი' }).click();
        const upgrade = page.locator('button[form="company-upgrade-form"][type="submit"]');
        await page.locator('#upgrade-company').fill(''); await upgrade.click();
        assert.equal(await page.locator('#upgrade-company').getAttribute('aria-invalid'), 'true');
        await page.locator('#upgrade-company').fill('შემოწმების კომპანია');
        await page.locator('#upgrade-industry').click(); await page.getByRole('option', { name: 'ავეჯი', exact: true }).click();
        assert.match(await upgrade.getAttribute('class'), /ma-btn--tint/);
        assert.equal(await cleanCount(page), 0);
        await upgrade.click(); await page.waitForURL('**/onboarding/?step=type', { timeout: 60000 });
        const upgraded = (await db.query('select role,company from profiles where id=$1', [ids.client])).rows[0];
        assert.equal(upgraded.role, 'company'); assert.equal(upgraded.company, 'შემოწმების კომპანია');
        pass('client: CompanyUpgrade tint validates, real become_company RPC, onboarding redirect');
      }
    } finally {
      await context.close();
      // Only columns affected by this script; no live Auth/password writes take place.
      const keys = ['name', 'contact_position', 'role', 'company', 'industry', 'verified', 'verified_at', 'provide_categories', 'account_intent', 'service_cities'];
      await db.query(`update profiles set ${keys.map((key, i) => `${key}=$${i + 2}`).join(',')} where id=$1`, [ids[role], ...keys.map(key => original[key])]);
      if (originalProducts) await db.query('update meetany_private.company_products set items=$2 where company_id=$1', [ids[role], JSON.stringify(originalProducts.items)]);
      if (business) {
        const columns = Object.keys(business).filter(key => key !== 'company_id');
        await db.query(`update meetany_private.company_business set ${columns.map((key, i) => `${key}=$${i + 2}`).join(',')} where company_id=$1`, [ids[role], ...columns.map(key => business[key])]);
      }
      else await db.query('delete from meetany_private.company_business where company_id=$1', [ids[role]]);
    }
  }
  assert.deepEqual(report.pageerrors, []);
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally { await browser.close(); await db.end(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ clean: report.clean.length, dirty: report.dirty.length, checks: report.checks.length, axe: report.axe.length, overlays: report.overlays.length, pageerrors: report.pageerrors, errors: report.errors }, null, 2));
