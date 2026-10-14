import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pg from 'pg';

const require = createRequire(import.meta.url);
const output = new URL('./', import.meta.url);
const BASE = 'http://127.0.0.1:3448', AUTH = 'http://127.0.0.1:4448';
const clientId = 'bacf1572-7493-4ac9-bfc7-95719e911c4c';
const title = 'ლოკალური შემოწმება — საოფისე მასალა';
process.loadEnvFile('.env.local');
const databaseUrl = new URL(process.env.MEETANY_LOCAL_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(databaseUrl.hostname));
assert.equal(databaseUrl.pathname, '/meetany_layout_post');
const db = new pg.Client({ connectionString: databaseUrl.toString() });
await db.connect();
const originalProfile = (await db.query('select * from public.profiles where id=$1', [clientId])).rows[0];
const originalDraft = (await db.query('select * from meetany_private.request_drafts where owner_id=$1', [clientId])).rows[0];
assert.equal(originalProfile.role, 'client');
const jwt = (await (await fetch(`${AUTH}/__mint?sub=${clientId}`)).json()).token;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = { pages: [], flows: [], errors: [], cleanup: false };

async function restoreProfile() {
  const keys = ['role', 'company', 'industry', 'verified', 'verified_at', 'provide_categories', 'account_intent'];
  await db.query(`update public.profiles set ${keys.map((key, i) => `${key}=$${i + 2}`).join(',')} where id=$1`, [clientId, ...keys.map(key => originalProfile[key])]);
}

async function audit(page, name, width, scope) {
  await page.evaluate(() => document.fonts.ready);
  const main = page.locator(scope);
  assert.equal(await main.locator('.ma-btn--primary:visible').count(), 1, `${name}: one form primary`);
  assert.equal(await main.locator('aside .ma-btn--primary').count(), 0, `${name}: no aside primary`);
  await main.locator('[data-form-footer] .ma-btn--primary').scrollIntoViewIfNeeded();
  const metrics = await page.evaluate(selector => {
    const visible = el => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const inViewport = el => visible(el) && el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight;
    return {
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      primaryInForm: [...document.querySelectorAll(`${selector} .ma-btn--primary`)].filter(visible).map(el => el.textContent),
      primaryInPage: [...document.querySelectorAll('main .ma-btn--primary')].filter(visible).map(el => el.textContent),
      primaryInViewport: [...document.querySelectorAll('main .ma-btn--primary')].filter(inViewport).map(el => el.textContent),
      footerPosition: getComputedStyle(document.querySelector(`${selector} [data-form-footer]`)).position,
    };
  }, scope);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
  const row = { name, width, ...metrics, axe };
  results.pages.push(row);
  console.log(JSON.stringify(row));
  assert.equal(metrics.overflow, 0);
  assert.equal(axe.length, 0);
  if (width !== 320) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}.png`, output)), fullPage: true });
  }
}

try {
  for (const width of [1440, 390, 320]) {
    await db.query('delete from meetany_private.request_drafts where owner_id=$1', [clientId]);
    const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block' });
    await context.route(`${AUTH}/**`, route => route.request().url().includes('/.well-known/') ? route.continue() : route.fulfill({
      headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', 'set-auth-jwt': jwt },
      json: route.request().url().includes('/get-session') ? { user: { id: clientId, email: 'qa@local.test', name: 'QA' } } : { token: jwt },
    }));
    await context.route(/https:\/\/.*\/auth\//, route => route.abort());
    await context.addInitScript(() => localStorage.setItem('meetany.session', '1'));
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => results.errors.push({ width, message: error.message }));
    await page.goto(`${BASE}/requests/new/`, { waitUntil: 'networkidle' });
    await page.locator('button[aria-controls="ma-account-menu"]').waitFor({ state: 'attached' });
    await audit(page, 'requests-new-step1', width, '.post-page');
    await page.locator('#title').fill(title);
    await page.locator('#category').click();
    await page.getByRole('option', { name: 'საოფისე და სამეურნეო', exact: true }).click();
    await page.locator('#body').fill('საჭიროა საოფისე მასალა ლოკალური ფორმის შემოწმებისთვის.');
    await page.locator('#quantity').fill('10');
    await page.locator('[data-form-footer] .ma-btn--primary').click();
    await page.locator('#neededBy').waitFor();
    await page.locator('#neededBy').fill(await page.locator('#neededBy').getAttribute('min'));
    await page.locator('[data-form-footer] .ma-btn--primary').click();
    await page.getByRole('heading', { name: 'გადახედვა', exact: true }).waitFor();
    await audit(page, 'requests-new-step3', width, '.post-page');
    await page.locator('[data-form-footer] .ma-btn--primary').click();
    await page.locator('.post-published').waitFor();
    const created = (await db.query('select id from public.requests where owner_id=$1 and title=$2', [clientId, title])).rows;
    assert.equal(created.length, 1);
    results.flows.push({ width, requestPublished: true, id: created[0].id });
    await db.query('delete from public.requests where id=$1', [created[0].id]);
    await page.goto(`${BASE}/account/?tab=profile#company-upgrade`, { waitUntil: 'networkidle' });
    await page.locator('#company-upgrade-form').waitFor();
    await audit(page, 'company-upgrade', width, '#company-upgrade');
    await page.locator('#upgrade-company').fill('ლოკალური სატესტო კომპანია');
    await page.locator('#upgrade-industry').click();
    await page.getByRole('option', { name: 'საოფისე და სამეურნეო', exact: true }).click();
    await page.locator('#company-upgrade [data-form-footer] .ma-btn--primary').click();
    await page.waitForURL('**/onboarding/?step=type');
    assert.equal((await db.query('select role from public.profiles where id=$1', [clientId])).rows[0].role, 'company');
    results.flows.push({ width, companyUpgrade: true, url: page.url() });
    await context.close();
    await restoreProfile();
  }
  assert.equal(results.errors.length, 0);
} catch (error) {
  results.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await restoreProfile();
  await db.query('delete from public.requests where owner_id=$1 and title=$2', [clientId, title]);
  await db.query('delete from meetany_private.request_drafts where owner_id=$1', [clientId]);
  if (originalDraft) await db.query('insert into meetany_private.request_drafts(owner_id,data,updated_at) values($1,$2,$3)', [clientId, originalDraft.data, originalDraft.updated_at]);
  results.cleanup = true;
  await fs.writeFile(new URL('results.json', output), JSON.stringify(results, null, 2) + '\n');
  await db.end();
}
