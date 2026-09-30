import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const origin = process.env.QA_ORIGIN || 'http://localhost:3001';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const home = async () => {
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('.ma-header__login').waitFor({ state: 'attached' });
  await page.locator('.home-company-grid[aria-busy="false"]').waitFor();
};
try {
  await home();
  const input = page.locator('#home-search');
  await input.focus();
  assert.equal(await page.locator('.search-suggestion--category').count(), 4);
  assert.equal(await page.locator('.search-suggestion--result').count(), 0);
  await input.press('ArrowDown');
  assert.equal(await input.getAttribute('aria-activedescendant'), 'home-search-option-0');
  await input.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  console.log('PASS empty search, keyboard selection, Escape');

  await input.fill('ა');
  await page.locator('.search-suggestion--result').first().waitFor();
  const panel = page.locator('.search-suggestions:not([hidden])');
  assert.equal(await panel.evaluate(el => getComputedStyle(el).opacity), '1', 'Suggestions must be opaque immediately, including while opening');
  const coverage = await panel.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hits = [];
    for (let y = r.top + 20; y < Math.min(r.bottom - 20, innerHeight); y += 24) {
      for (const x of [r.left + 24, r.left + r.width / 2, r.right - 24]) hits.push(el.contains(document.elementFromPoint(x, y)));
    }
    return hits;
  });
  assert(coverage.length > 0 && coverage.every(Boolean), 'Lower content must not paint or intercept clicks above the dropdown');
  fs.mkdirSync('qa/shots/search-dropdown', { recursive: true });
  await page.screenshot({ path: 'qa/shots/search-dropdown/desktop-results.png' });
  console.log('PASS populated search stays above underlying category icons and cards');

  await input.press('Escape');
  await page.getByRole('combobox', { name: 'ქალაქი', exact: true }).click();
  await page.getByRole('option', { name: 'თბილისი', exact: true }).click();
  await input.focus();
  const all = page.getByRole('link', { name: 'ყველა შედეგის ნახვა', exact: true });
  const href = new URL(await all.getAttribute('href'), origin);
  assert.equal(href.searchParams.get('q'), 'ა');
  assert.equal(href.searchParams.get('city'), 'tbilisi');
  await all.click();
  await page.waitForURL(url => url.pathname === '/companies/' && url.searchParams.get('city') === 'tbilisi' && url.searchParams.get('q') === 'ა', { waitUntil: 'domcontentloaded' });
  console.log('PASS full-results navigation preserves query and city');

  await home();
  await input.focus();
  await input.press('ArrowDown');
  await input.press('Enter');
  await page.waitForURL(url => url.pathname === '/companies/' && url.searchParams.has('industry'), { waitUntil: 'domcontentloaded' });
  console.log('PASS keyboard category navigation');

  await home();
  await page.locator('.market-search-types label').filter({ hasText: 'მოთხოვნები' }).click();
  await input.fill('ა');
  assert.equal(new URL(await page.getByRole('link', { name: 'ყველა შედეგის ნახვა', exact: true }).getAttribute('href'), origin).pathname, '/requests/');
  console.log('PASS request mode full-results destination');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await home();
    await input.focus();
    await page.screenshot({ path: `qa/shots/search-dropdown/mobile-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    const r = await panel.boundingBox();
    assert(r.x >= 0 && r.x + r.width <= width, 'Dropdown stays within the viewport');
    await input.fill('zzzzzz-not-a-company');
    await page.locator('.search-suggestions--empty').waitFor();
    await input.press('Escape');
    await page.locator('.search-suggestions--empty').waitFor({ state: 'hidden' });
    console.log(`PASS mobile ${width}, no-result state, Escape`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS zero browser runtime errors');
} finally { await browser.close(); }
