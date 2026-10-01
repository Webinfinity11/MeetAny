// Presentation labels, real demo links and reduced-motion behavior; no marketplace writes.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { auth, credentials, safe, assert } from './e2e/lib.mjs';
import { guard } from './visual/lib/browser.mjs';

const origin = process.env.PRESENTATION_ORIGIN || 'http://localhost:3002';
assert(['http://localhost:3002', 'https://meet-any.vercel.app'].includes(origin));
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const out = `qa/shots/admin-presentation-${origin.includes('localhost') ? 'local' : 'live'}`;
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [];
const sections = [
  ['', 'ანალიტიკა'], ['requests', 'მოთხოვნები'], ['users', 'მომხმარებლები'],
  ['offers', 'შეთავაზებები'], ['reports', 'საჩივრები'], ['reviews', 'შეფასებები'],
  ['plans', 'Premium / VIP პაკეტები'], ['photos', 'ფოტოების შემოწმება'],
  ['audit', 'მოქმედებების ისტორია'], ['contacts', 'დაკავშირების სტატისტიკა'], ['demo', 'სადემო გზამკვლევი'],
];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const state = { blocked: [], chat: null, interceptions: 0 };
  await guard(context, state);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const login = await page.request.post(auth + '/sign-in/email', { data: credentials('owner_admin') });
  assert(login.ok(), 'admin login');
  for (const [tab, title] of sections) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + '/admin/' + (tab ? '?tab=' + tab : ''), { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('main [role="alert"]').count(), 0, `${tab} available`);
    assert.equal((await page.locator('nav[aria-label="ადმინისტრირების განყოფილებები"] [aria-current="page"]').innerText()).trim(), title);
    if (!tab) {
      await page.getByRole('heading', { name: 'მოთხოვნა და მომწოდებლები', exact: true }).waitFor();
      assert((await page.locator('main').innerText()).includes('მომწოდებლის არჩევის წილი'));
    }
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(450);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tab} ${width} overflow`);
      if (['', 'requests', 'users', 'contacts', 'demo'].includes(tab)) await page.screenshot({ path: `${out}/${tab || 'analytics'}-${width}.png`, fullPage: true });
      results.push({ section: tab || 'analytics', width, pass: true });
    }
  }
  const steps = page.locator('ol > li');
  assert.equal(await steps.count(), 4, 'four presentation steps');
  const examples = page.locator('a[href^="/requests/view/?id="]');
  assert(await examples.count() > 0, 'real seeded examples available');
  for (const href of await examples.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))) {
    const response = await page.request.get(origin + href);
    assert.equal(response.status(), 200, 'demo request link');
  }
  const menu = page.getByRole('button', { name: /განყოფილება/ });
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'mobile menu starts closed');
  await menu.click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'expanded mobile menu fits');
  await page.getByRole('link', { name: 'მოთხოვნები', exact: true }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Escape closes menu');
  assert(await menu.evaluate(el => el === document.activeElement), 'menu retains keyboard focus');
  await menu.click();
  await page.getByRole('link', { name: 'მოთხოვნები', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: 'მოთხოვნები', exact: true }).waitFor();
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'navigation closes menu');
  await menu.click();
  await page.getByRole('link', { name: 'სადემო გზამკვლევი', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: 'სადემო გზამკვლევი', exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'guide fits 320');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.notEqual(await steps.first().evaluate(el => getComputedStyle(el).animationName), 'none', 'card entrance enabled');
  const button = page.getByRole('link', { name: 'მოთხოვნების ნახვა', exact: true });
  await button.hover(); await page.waitForTimeout(250);
  assert.notEqual(await button.evaluate(el => getComputedStyle(el).transform), 'none', 'button hover motion enabled');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await steps.first().evaluate(el => getComputedStyle(el).animationName), 'none', 'card respects reduced motion');
  // Media emulation can resolve before the browser's next style/transition frame.
  await page.waitForFunction(() => [...document.querySelectorAll('a')].filter(el => el.textContent.includes('მოთხოვნების ნახვა')).every(el => getComputedStyle(el).transform === 'none'), null, { timeout: 1000 });
  assert.equal(await button.evaluate(el => getComputedStyle(el).transform), 'none', 'button respects reduced motion');
  await page.getByRole('link', { name: 'ანალიტიკა', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: 'ანალიტიკა', exact: true }).waitFor();
  assert(!new URL(page.url()).searchParams.has('tab'), 'navigation uses analytics landing');
  const supply = page.locator('details').filter({ has: page.locator('summary', { hasText: 'სად არის მეტი მომწოდებელი საჭირო?' }) });
  await supply.locator('summary').click();
  await supply.locator('table').waitFor({ state: 'visible' });
  await supply.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await supply.getAttribute('open'), null, 'detail disclosure closes by keyboard');

  await page.goto(origin + '/admin/?tab=requests');
  const firstTitle = page.locator('td[data-label="მოთხოვნა"] button').first();
  await firstTitle.waitFor();
  await firstTitle.click();
  await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('dialog[open]').waitFor({ state: 'hidden' });
  const selection = page.getByRole('checkbox', { name: /^მონიშვნა:/ }).first();
  await selection.check();
  const bulk = page.getByRole('region', { name: 'მონიშნულ ჩანაწერებზე მოქმედებები' });
  await bulk.waitFor();
  await bulk.getByRole('button', { name: 'გაუქმება', exact: true }).click();
  assert.equal(await selection.isChecked(), false, 'bulk selection clears');
  await page.locator('#admin-search').fill('qa-no-match-presentation-unique');
  await page.getByRole('heading', { name: 'ამ ფილტრებით ჩანაწერები ვერ მოიძებნა' }).waitFor();
  await page.getByRole('button', { name: 'ფილტრების გასუფთავება', exact: true }).first().click();
  await firstTitle.waitFor();
  assert.equal(await page.locator('#admin-search').inputValue(), '', 'clear filters restores list');
  assert.deepEqual(state.blocked, []); assert.deepEqual(errors, []);
  await context.close();

  const guest = await browser.newPage();
  guest.on('pageerror', e => errors.push(e.message));
  await guard(guest.context(), state);
  await guest.goto(origin + '/admin/?tab=demo');
  await guest.getByText('ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.', { exact: true }).waitFor();
  assert.equal(await guest.getByRole('heading', { name: 'როგორ წარვადგინოთ — 4 ნაბიჯი' }).count(), 0);
  await guest.goto(origin + '/companies/');
  const vip = guest.locator('.company-card__plan[data-plan="vip"]').first();
  await vip.waitFor();
  assert.equal(await guest.locator('[data-plan="vip"] svg').count(), 0, 'VIP badge is text only');
  assert.equal(await vip.evaluate(el => getComputedStyle(el).boxShadow), 'none', 'VIP has no decorative shadow');
  for (const width of [1440, 390]) {
    await guest.setViewportSize({ width, height: 1000 });
    await guest.screenshot({ path: `${out}/vip-${width}.png`, fullPage: true });
    assert(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'VIP catalogue fits');
  }
  const profile = await vip.locator('..').locator('.card-main-link').getAttribute('href');
  await guest.goto(origin + profile);
  await guest.locator('.business-tier[data-plan="vip"]').waitFor();
  assert.equal(await guest.locator('.business-tier[data-plan="vip"] svg').count(), 0, 'profile VIP is text only');
  await guest.close();
  assert.deepEqual(errors, []); assert.deepEqual(state.blocked, []);
  console.log('PASS: 11 admin sections × 5 widths; mobile menu/Escape/navigation; demo links; motion/reduced-motion; guest access; text-only VIP catalogue/profile');
} catch (error) {
  errors.push(safe(error.stack)); console.error(safe(error.stack)); process.exitCode = 1;
} finally {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ origin, results, errors, passed: !process.exitCode }, null, 2));
  await browser.close();
}
