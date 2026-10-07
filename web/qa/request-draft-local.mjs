// Local browser regression: real UI/store, deterministic intercepted auth/RPC responses.
// No database, shared browser, production credentials, or remote requests are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3216';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = 'qa/shots/request-draft-local';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1200, height: 950 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const key = 'meetany.requestDraft';
const steps = [], errors = [], remote = [];
let signedIn = false, failCreate = true, creates = 0, created = null;
const profile = { id: '11111111-1111-4111-8111-111111111111', role: 'client', name: 'მონახაზის ტესტი', company: 'მონახაზის ტესტი', email: 'draft@example.test', city: 'tbilisi', created_at: new Date().toISOString() };
const jwt = role => `qa.${Buffer.from(JSON.stringify({ sub: profile.id, email: profile.email, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.qa`;
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) { remote.push(url.origin); return route.abort(); }
  const path = url.pathname;
  if (path.startsWith('/__qa_auth/')) {
    if (path.endsWith('/sign-in/email')) signedIn = true;
    if (path.endsWith('/sign-out')) signedIn = false;
    const json = path.endsWith('/get-session') ? (signedIn ? { user: profile } : null)
      : path.endsWith('/token/anonymous') ? { token: jwt('anonymous') }
      : path.endsWith('/token') ? { token: jwt('authenticated') } : {};
    return route.fulfill({ json });
  }
  if (path.startsWith('/api/')) {
    if (path.endsWith('/rpc/create_request')) {
      creates++;
      if (failCreate) return route.fulfill({ status: 503, json: { message: 'QA temporary failure' } });
      const input = route.request().postDataJSON();
      created = { id: '22222222-2222-4222-8222-222222222222', owner_id: profile.id, created_at: new Date().toISOString(), status: 'open' };
      for (const [key, value] of Object.entries(input)) created[key.slice(2)] = value;
      return route.fulfill({ json: created });
    }
    const json = path.endsWith('/rpc/my_profile') ? (signedIn ? [profile] : [])
      : path.endsWith('/capabilities') ? { engagement: false }
      : path.endsWith('/requests') ? (created ? [created] : []) : [];
    return route.fulfill({ json });
  }
  return route.continue();
});
const go = async path => { await page.goto(origin + path); await page.locator('#title').waitFor(); };
const choose = async (id, value) => {
  const label = await page.locator(`#${id} + select option[value="${value}"]`).textContent();
  await page.locator(`#${id}`).click();
  await page.locator(`#${id}-options`).getByRole('option', { name: label, exact: true }).click();
};
const saved = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key);
const checkSaved = async expected => {
  await page.waitForFunction(({ key, expected }) => {
    const value = JSON.parse(sessionStorage.getItem(key));
    return value && Object.entries(expected).every(([k, v]) => value[k] === v);
  }, { key, expected });
};
const next = () => page.locator('button[form="post-request-form"]').click();
const capture = async (label, width) => {
  await page.setViewportSize({ width, height: 950 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: `${output}/${label}-${width}.png`, animations: 'disabled' });
};
const details = async expected => {
  for (const id of ['title', 'body', 'quantity']) assert.equal(await page.locator(`#${id}`).inputValue(), expected[id]);
  for (const id of ['category', 'unit']) assert.equal(await page.locator(`#${id} + select`).inputValue(), expected[id]);
};
const delivery = async expected => {
  await next();
  await page.locator('#neededBy').waitFor();
  for (const id of ['addressNote', 'neededBy']) assert.equal(await page.locator(`#${id}`).inputValue(), expected[id]);
  assert.equal(await page.locator('#city + select').inputValue(), expected.city);
};
const expected = { title: 'ხის მაგიდების შეკვეთა', body: 'გვჭირდება ხის მაგიდები ადგილზე მიწოდებით და აწყობით.', category: 'furniture', quantity: '7', unit: 'm2', city: 'batumi', addressNote: 'სანაპიროს ქუჩა 12' };
try {
  await go('/requests/new/');
  for (const id of ['title', 'body', 'quantity']) await page.locator(`#${id}`).fill(expected[id]);
  await choose('category', expected.category); await choose('unit', expected.unit);
  await next(); await choose('city', expected.city);
  await page.locator('#addressNote').fill(expected.addressNote);
  expected.neededBy = await page.locator('#neededBy').getAttribute('min');
  await page.locator('#neededBy').fill(expected.neededBy);
  const stored = { ...expected, neededByText: expected.neededBy.split('-').reverse().join('.') }; delete stored.neededBy;
  await checkSaved(stored);
  assert.deepEqual(Object.keys(await saved()).sort(), [...Object.keys(stored), 'at'].sort());
  await page.reload(); await page.locator('#title').waitFor(); await details(expected); await delivery(expected);
  steps.push('All eight text fields survive reload without draft=1; storage contains text and timestamp only');
  await page.locator('.ma-header__brand').first().click(); await page.waitForURL(origin + '/');
  await page.goBack(); await page.locator('#title').waitFor(); await details(expected); await delivery(expected);
  steps.push('Client route navigation and browser Back restore the tab draft');
  await go('/requests/new/');
  for (const width of [1200, 390]) {
    await capture('details', width);
  }
  await page.setViewportSize({ width: 1200, height: 950 });
  const loginLink = page.locator('.post-guest a').first();
  const loginHref = await loginLink.getAttribute('href');
  assert.equal(new URLSearchParams(new URL(loginHref, origin).searchParams.get('next').split('?')[1]).get('draft'), '1');
  await loginLink.click(); await page.locator('#login-email').fill(profile.email);
  await page.locator('#login-password').fill('local-test-only');
  await page.locator('#login-password').press('Enter'); await page.waitForURL(/\/requests\/new\//);
  await page.locator('input[type=file]').waitFor({ state: 'attached' }); await details(expected); await delivery(expected);
  steps.push('Guest login next returns to restored draft in isolated mocked auth session');
  await go('/requests/new/');
  await page.locator('input[type=file]').setInputFiles('public/assets/photos/workshop-banner.jpg');
  await page.locator('.post-preview__photo').waitFor();
  await page.reload(); await page.locator('#title').waitFor(); await details(expected);
  assert.equal(await page.locator('input[type=file]').evaluate(el => el.files.length), 0);
  assert.equal(await page.locator('.post-preview__photo').count(), 0);
  steps.push('Real File is not persisted across reload');
  await page.locator('.ma-menu__trigger[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'გასვლა', exact: true }).click();
  await go('/requests/new/'); await details(expected);
  await page.locator('.post-guest a').first().click();
  await page.locator('#login-email').fill(profile.email); await page.locator('#login-password').fill('local-test-only');
  await page.locator('#login-password').press('Enter'); await page.waitForURL(/\/requests\/new\//);
  await page.locator('input[type=file]').waitFor({ state: 'attached' }); await details(expected); await delivery(expected);
  steps.push('Logout and relogin retain text within the same tab');
  await next(); await next(); await page.locator('.post-actions [role=alert]').waitFor();
  assert.equal(creates, 1); await checkSaved(stored);
  await page.reload(); await page.locator('#title').waitFor(); await details(expected); await delivery(expected);
  steps.push('Failed create RPC retains draft, including after reload');
  for (const width of [1200, 390]) {
    await capture('delivery', width);
  }
  await next(); failCreate = false; await next(); await page.locator('.post-published').waitFor();
  assert.equal(creates, 2); assert.equal(await saved(), null);
  assert.equal(created.title, expected.title); assert.equal(created.needed_by, expected.neededBy);
  for (const width of [1200, 390]) {
    await capture('published', width);
    assert.equal(await saved(), null);
  }
  await page.reload(); await page.locator('#title').waitFor(); assert.equal(await page.locator('#title').inputValue(), '');
  steps.push('Successful RPC clears draft; published rerenders and reload do not resurrect submitted text');
  await page.evaluate(({ key, stored }) => sessionStorage.setItem(key, JSON.stringify({ ...stored, at: Date.now() })), { key, stored });
  await go('/requests/new/?title=ახალი%20სათაური&category=other&city=kutaisi');
  assert.equal(await page.locator('#title').inputValue(), 'ახალი სათაური');
  assert.equal(await page.locator('#category + select').inputValue(), 'other');
  assert.equal(await page.locator('#body').inputValue(), expected.body);
  await page.locator('#title').fill('ახალი შესწორებული სათაური'); await checkSaved({ title: 'ახალი შესწორებული სათაური', city: 'kutaisi' });
  await page.reload(); await page.locator('#title').waitFor(); assert.equal(await page.locator('#title').inputValue(), 'ახალი შესწორებული სათაური');
  await next(); assert.equal(await page.locator('#city + select').inputValue(), 'kutaisi');
  steps.push('Explicit title/category/city override old draft once; later edits survive reload');
  await page.evaluate(({ key, stored }) => sessionStorage.setItem(key, JSON.stringify({ ...stored, at: Date.now() - 31 * 60_000 })), { key, stored });
  await go('/requests/new/'); assert.equal(await page.locator('#title').inputValue(), '');
  steps.push('Draft expires after 30 minutes');
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({ pass: true, origin, steps, errors, remote }, null, 2));
  console.log(JSON.stringify({ pass: true, steps }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({ pass: false, steps, error: error.stack, errors, remote }, null, 2));
  throw error;
} finally { await browser.close(); }
