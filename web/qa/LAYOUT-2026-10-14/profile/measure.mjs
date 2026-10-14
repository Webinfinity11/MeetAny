import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:3445';
const AUTH = process.env.AUTH || 'http://127.0.0.1:4445';
const phase = process.argv[2] || 'after';
const out = `qa/LAYOUT-2026-10-14/profile/${phase}`;
const ids = { company: '74cc28fc-47de-45cb-9563-93735b86855e', client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c' };
export async function signedContext(browser, role, width = 1440) {
  const jwt = (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block' });
  await context.route(`${AUTH}/**`, route => {
    if (route.request().url().includes('/.well-known/')) return route.continue();
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', 'set-auth-jwt': jwt }, json: route.request().url().includes('/get-session') ? { user: { id: ids[role], email: 'qa@local.test', name: 'QA' } } : { token: jwt } });
  });
  await context.route(/https:\/\/.*\/auth\//, route => route.abort());
  await context.addInitScript(() => localStorage.setItem('meetany.session', '1'));
  return context;
}
export async function settle(page) {
  await page.locator('button[aria-controls="ma-account-menu"]').waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.account-shell') && !document.querySelector('main').innerText.includes('იტვირთება') && ![...document.querySelectorAll('.ma-skel,.ma-loading__panel,[aria-busy="true"]')].some(el => el.getClientRects().length), null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}
if (process.argv[1].endsWith('/measure.mjs')) {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const previous = process.env.PAGES && fs.existsSync(`${out}/metrics.json`) ? JSON.parse(fs.readFileSync(`${out}/metrics.json`)) : {};
  const rows = previous.rows || [], errors = previous.errors || [];
  try {
    for (const role of Object.keys(ids)) for (const width of (process.env.WIDTHS || '1440,390,360').split(',').map(Number)) {
      const context = await signedContext(browser, role, width), page = await context.newPage();
      let name = '';
      page.on('pageerror', error => errors.push({ role, width, name, message: error.message }));
      const tabs = ['overview','requests','deals','saved','messages','notifications', ...(role === 'company' ? ['opportunities','offers'] : ['profile'])];
      const routes = tabs.map(tab => [tab, `/account/?tab=${tab}`]).concat(role === 'company' ? ['details','legal','documents','products','distribution','security'].map(section => [section, `/account/?tab=profile&section=${section}`]) : []);
      for (const [label, path] of routes) {
        if (process.env.PAGES && !new RegExp(process.env.PAGES).test(path)) continue;
        name = label;
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await settle(page);
        const metric = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), mainHeight: Math.round(document.querySelector('.account-shell').getBoundingClientRect().height) }));
        const index = rows.findIndex(row => row.role === role && row.name === name && row.width === width);
        if (index >= 0) rows.splice(index, 1);
        rows.push({ role, name, width, path, ...metric });
        await page.screenshot({ path: `${out}/${role}-${name}-${width}.png`, fullPage: true });
        fs.writeFileSync(`${out}/metrics.json`, JSON.stringify({ rows, errors }, null, 2));
        console.log(role, name, width, metric.scrollHeight, metric.overflow);
      }
      await context.close();
    }
  } finally { await browser.close(); }
  if (errors.length || rows.some(row => row.overflow)) process.exitCode = 1;
}
