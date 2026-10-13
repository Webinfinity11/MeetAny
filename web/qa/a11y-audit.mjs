// Local fixture only; never submits mutations or contacts live Auth.
// BASE=http://localhost:3709 AUTH=http://127.0.0.1:3719 node qa/a11y-audit.mjs --role all
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://localhost:3709';
const AUTH = process.env.AUTH || 'http://127.0.0.1:3719';
if (![BASE, AUTH].every(url => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))) throw new Error('Only loopback fixtures are supported');
const roleArg = process.argv.indexOf('--role');
const role = roleArg < 0 ? 'all' : process.argv[roleArg + 1];
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e', admin: 'd2517b00-554d-4e6b-929a-ef3da51f3b47' };
const request = process.env.REQUEST_ID || '0101aaac-f4e6-4ed4-b1bd-5a52e0942db9';
const company = process.env.COMPANY_ID || ids.company;
const deal = process.env.DEAL_ID || '8e6766e1-b67e-408a-a8c0-e9e6944e115b';
const requestPath = `/requests/view/?id=${request}`;
const adminTabs = ['overview','requests','companies','deals','offers','users','reports','reviews','content','contacts','photos','audit'];
const routes = {
  guest: ['/', '/requests/', '/companies/', requestPath, `/companies/view/?id=${company}`, '/how-it-works/', '/terms/', '/account/', '/account/?tab=register', '/requests/new/'],
  client: ['overview','requests','deals','saved','messages','notifications','profile'].map(tab => `/account/?tab=${tab}`).concat(requestPath, `/deals/view/?id=${deal}`),
  company: ['opportunities','offers','deals'].map(tab => `/account/?tab=${tab}`).concat(['details','legal','documents','products','distribution','security'].map(section => `/account/?tab=profile&section=${section}`), '/matching/', `/offers/new/?requestId=${request}`),
  admin: adminTabs.map(tab => `/admin/?tab=${tab}`),
};
if (role !== 'all' && !routes[role]) throw new Error('Unknown --role');
const output = process.env.A11Y_OUTPUT || 'qa/p7-a11y';
fs.mkdirSync(`${output}/shots`, { recursive: true });
const result = { at: new Date().toISOString(), base: BASE, axe: require('axe-core/package.json').version, ids: { ...ids, request, company, deal }, pages: [], keyboard: [], failures: [] };
const browser = await chromium.launch({ ...(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
async function runRole(r) {
  let meta;
  async function audit(page, state = 'page') {
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const data = await page.evaluate(async () => {
      const scan = await window.axe.run({ runOnly: ['wcag2a','wcag2aa','wcag21aa','best-practice'] });
      return { violations: scan.violations, incomplete: scan.incomplete, passes: scan.passes.length, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
    });
    result.pages.push({ ...meta, state, ...data });
    fs.writeFileSync(`${output}/results.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(`${meta.role} ${meta.theme} ${meta.width} ${meta.path} ${state}: ${data.violations.map(v => `${v.impact}:${v.id}(${v.nodes.length})`).join(', ') || '0'}`);
  }
  async function settle(page) {
    // Wait for the session before checking loaders: it mounts private attachments/forms.
    if (meta.role === 'guest') await page.locator('header').first().locator('a[href="/account/"]').filter({ hasText: 'შესვლა' }).waitFor({ state: 'attached', timeout: 20000 });
    else await page.locator('button[aria-controls="ma-account-menu"]').waitFor({ state: 'attached', timeout: 20000 });
    // Remote gallery images and background polling are not application readiness.
    await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => {});
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      const busy = [...document.querySelectorAll('[aria-busy="true"],.ma-skel,.ma-loading__panel,.account-loading-shell,.request-form__skeleton')]
        .some(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      return Boolean(main?.innerText.trim()) && !busy && !main.innerText.includes('იტვირთება');
    }, null, { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    // Let data-driven disabled/enabled transitions finish as well as entry animations.
    await page.waitForTimeout(500);
    // Audit the settled colors, not the intermediate opacity of entry animations.
    await page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
  }

  async function dialogCheck(page, name, opener, { tabTo = false, nested } = {}) {
    const row = { ...meta, name, passed: false };
    try {
      await opener.waitFor({ state: 'visible', timeout: 5000 });
      if (tabTo) {
        await page.evaluate(() => { document.activeElement?.blur(); });
        for (let i = 0; i < 40 && !await opener.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
      } else await opener.focus();
      if (!await opener.evaluate(el => el === document.activeElement)) throw new Error('Opener not keyboard focused');
      await page.keyboard.press('Enter');
      const dialog = page.locator('dialog[open]').last();
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      // Preserve this node: after closing a nested sheet, [open].last() selects its parent.
      const dialogNode = await dialog.elementHandle();
      await settle(page);
      if (!await dialog.evaluate(el => el.contains(document.activeElement))) throw new Error('Initial focus outside dialog');
      const modal = await dialog.evaluate(el => el.matches(':modal'));
      if (modal) {
        const count = await dialog.locator('a[href],button,input,select,textarea,[tabindex]').count();
        for (let i = 0; i < count + 2; i++) {
          await page.keyboard.press('Tab');
          if (!await dialog.evaluate(el => el.contains(document.activeElement))) throw new Error('Tab escaped dialog');
        }
        await page.keyboard.press('Shift+Tab');
        if (!await dialog.evaluate(el => el.contains(document.activeElement))) throw new Error('Shift+Tab escaped dialog');
      }
      await audit(page, name);
      await page.screenshot({ path: `${output}/shots/${meta.role}-${meta.theme}-${meta.width}-${name}-${encodeURIComponent(meta.path)}.png` });
      if (nested) await nested(dialog);
      await page.keyboard.press('Escape');
      await dialogNode.waitForElementState('hidden', { timeout: 5000 });
      if (!await opener.evaluate(el => el === document.activeElement)) throw new Error('Focus did not return to opener');
      row.passed = true;
    } catch (error) { row.error = error.message; await page.keyboard.press('Escape'); }
    result.keyboard.push(row);
  }
  async function keyboard(page) {
    if (meta.path === routes[meta.role][0]) {
      if (meta.width <= 390) await dialogCheck(page, 'mobile-menu', page.getByRole('button', { name: 'მენიუ', exact: true }), { tabTo: true });
      if (meta.role !== 'guest') {
        // Narrow headers expose these links in the mobile dialog instead.
        if (meta.width >= 1024) {
          const row = { ...meta, name: 'account-menu', passed: false };
          try {
            const opener = page.locator('button[aria-controls="ma-account-menu"]');
            await opener.focus(); await page.keyboard.press('ArrowDown');
            if (!await page.getByRole('menuitem').first().evaluate(el => el === document.activeElement)) throw new Error('ArrowDown did not focus first menuitem');
          await settle(page);
          await audit(page, 'account-menu');
            await page.keyboard.press('Escape');
            if (!await opener.evaluate(el => el === document.activeElement)) throw new Error('Menu focus not restored');
            row.passed = true;
          } catch (error) { row.error = error.message; }
          result.keyboard.push(row);
        }
        if (meta.role !== 'admin') await dialogCheck(page, 'chat', page.locator('button.ma-chat-unread'));
      }
    }
    if (meta.role === 'guest' && meta.width <= 390 && ['/requests/','/companies/'].includes(meta.path)) await dialogCheck(page, 'filters', page.getByRole('button', { name: /^ფილტრები/ }));
    if (meta.role === 'client' && meta.path === requestPath) {
      const more = page.locator('.request-manage-more > summary');
      await more.focus(); await page.keyboard.press('Enter');
      await dialogCheck(page, 'confirm-close', page.getByRole('button', { name: 'მოთხოვნის დახურვა', exact: true }));
      await dialogCheck(page, 'choose-offer', page.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).first());
      await dialogCheck(page, 'chat-thread', page.getByRole('button', { name: 'მიწერა', exact: true }).first());
    }
    if (meta.role === 'admin' && meta.path === '/admin/?tab=requests') {
      await dialogCheck(page, 'admin-detail', page.getByRole('button', { name: 'დეტალების ნახვა', exact: true }).first(), {
        nested: async dialog => dialogCheck(page, 'moderation', dialog.getByRole('button', { name: /^(დამალვა|გამოჩენა)…$/ })),
      });
    }
  }
    const jwt = r === 'guest' ? null : (await (await fetch(`${AUTH}/__mint?sub=${ids[r]}`)).json()).token;
    for (const theme of ['blue','classic']) for (const width of (process.env.WIDTHS || '1440,390').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block' });
      await context.route(`${AUTH}/**`, route => {
        const url = route.request().url();
        if (url.includes('/.well-known/')) return route.continue();
        return route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? { 'set-auth-jwt': jwt } : {}) }, json: url.includes('/get-session') ? (jwt ? { user: { id: ids[r], email: 'a11y@local.test', name: 'A11y' } } : null) : { token: jwt } });
      });
      // Block accidental live auth traffic even if a misconfigured build points elsewhere.
      await context.route(/https:\/\/.*\/auth\//, route => route.abort());
      await context.addInitScript(({ theme, signedIn }) => { localStorage.setItem('meetany.theme', theme); if (signedIn) localStorage.setItem('meetany.session', '1'); }, { theme, signedIn: !!jwt });
      const page = await context.newPage();
      page.on('pageerror', error => result.failures.push({ ...meta, error: error.message }));
      page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/db/')) result.failures.push({ ...meta, error: `DB HTTP ${response.status()}` }); });
      for (const path of routes[r].filter(path => !process.env.PAGES || new RegExp(process.env.PAGES).test(path))) {
        meta = { role: r, theme, width, path };
        try {
          const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
          if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
          await settle(page);
          await page.waitForFunction(() => Boolean(document.querySelector('main')?.innerText.trim()), null, { timeout: 20000 });
          if (r !== 'guest') await page.locator('button[aria-controls="ma-account-menu"]').waitFor({ state: 'attached', timeout: 10000 });
          await audit(page);
          await keyboard(page);
          await page.screenshot({ path: `${output}/shots/${r}-${theme}-${width}-${encodeURIComponent(path)}.png`, fullPage: true });
        } catch (error) { result.failures.push({ ...meta, error: error.message }); console.log('FAIL', JSON.stringify({ ...meta, error: error.message })); }
      }
      await context.close();
    }
}
try {
  const roles = role === 'all' ? Object.keys(routes) : [role];
  const runs = await Promise.allSettled(roles.map(runRole));
  runs.forEach((run, index) => { if (run.status === 'rejected') result.failures.push({ role: roles[index], error: String(run.reason) }); });
} finally {
  await browser.close();
  const order = row => `${row.role}/${row.theme}/${row.width}/${row.path}/${row.state || row.name}`;
  result.pages.sort((a, b) => order(a).localeCompare(order(b)));
  result.keyboard.sort((a, b) => order(a).localeCompare(order(b)));
  result.counts = {};
  for (const page of result.pages) for (const violation of page.violations) result.counts[violation.impact] = (result.counts[violation.impact] || 0) + violation.nodes.length;
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(result, null, 2) + '\n');
  const rows = result.pages.flatMap(p => (p.violations.length ? p.violations : [{ impact: '—', id: '—', nodes: [] }]).map(v => `| ${p.role} ${p.path} (${p.state}) | ${p.theme} | ${p.width} | ${v.impact} | ${v.id} | ${v.nodes.length} |`));
  fs.writeFileSync(`${output}/results.md`, `| გვერდი | თემა | სიგანე | impact | წესი | ელემენტები |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\nკლავიატურა: ${result.keyboard.filter(k => k.passed).length}/${result.keyboard.length}\n\n${JSON.stringify(result.counts)}\n`);
}
console.log(JSON.stringify({ counts: result.counts, keyboard: result.keyboard.filter(k => !k.passed), failures: result.failures }));
if (result.counts.serious || result.counts.critical || result.failures.length || result.keyboard.some(k => !k.passed) || result.pages.some(p => p.overflow > 0)) process.exitCode = 1;
