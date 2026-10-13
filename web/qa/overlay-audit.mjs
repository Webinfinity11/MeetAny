// Header menus must never be covered by page content (2026-10-13: the catalog header sat above the
// notification popover). Opens the notification and profile menus on key pages at 390/980/1440 as the
// demo company and reports any element painted over the open menu.
//   BASE=http://localhost:3311 node qa/overlay-audit.mjs      (exit code 1 on any overlap)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE || 'http://localhost:3000';
const md = fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md', import.meta.url), 'utf8');
const json = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
const acc = (json.state?.accounts || json.accounts).owner_company;

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await browser.newContext();
const login = await ctx.newPage();
await login.goto(base + '/account/', { waitUntil: 'networkidle' });
if (await login.$('#login-email')) {
  await login.fill('#login-email', acc.email);
  await login.fill('#login-password', acc.password);
  await login.click('form button[type=submit]');
  await login.waitForTimeout(3000);
}
await login.close();

const pages = ['/', '/requests/', '/companies/', '/account/', '/how-it-works/'];
const view = (await (await fetch(base + '/requests/')).text()).match(/\/requests\/view\/\?id=[0-9a-f-]{36}/)?.[0];
if (view) pages.push(view);

let problems = 0;
for (const width of [390, 980, 1440]) for (const path of pages) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height: 820 });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  for (const label of ['შეტყობინებები', 'პროფილი']) {
    const button = await page.$(`header button[aria-label="${label}"]`);
    if (!button || !(await button.isVisible())) continue;
    await button.click();
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const open = [...document.querySelectorAll('header [id], header [role=menu], header [class*=popover], header [class*=menu]')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.height > 40 && r.top >= 0 && getComputedStyle(e).visibility !== 'hidden'; })
        .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
      if (!open) return 'none';
      const r = open.getBoundingClientRect();
      const hits = new Set();
      for (let y = r.top + 8; y < r.bottom - 4; y += 10) for (let x = r.left + 8; x < r.right - 4; x += 24) {
        const e = document.elementFromPoint(x, y);
        if (e && !open.contains(e) && !e.closest('header[class*=ma-header]')) hits.add(`${e.tagName}.${String(e.className).slice(0, 40)}`);
      }
      return hits.size ? [...hits].join(', ') : 'ok';
    });
    if (result !== 'ok' && result !== 'none') problems++;
    console.log(`${width} ${path.slice(0, 30)} ${label}: ${result}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.close();
}
console.log('overlaps:', problems);
await browser.close();
process.exit(problems ? 1 : 0);
