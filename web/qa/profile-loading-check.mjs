// P12 T12.3f: account tabs must show a skeleton while loading, never "მიუწვდომელია".
// Run: QA_ORIGIN=http://localhost:3001 node qa/profile-loading-check.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/ideal-0924');
const browser = await chromium.launch({headless:true, executablePath});
let failed = false;

async function login(p, key) {
  await p.goto(base + '/account/', {waitUntil:'networkidle'});
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('#login-email'), null, {timeout:60000});
}

// mode "hard": signed in, then a full load of the tab. mode "login": the engagement RPC is slow from the
// moment of sign-in, and the tab is opened client-side while the account is already rendered (the e2e case).
async function check(key, tab, mode, shots) {
  const ctx = await browser.newContext({viewport:{width:1440, height:1000}});
  const p = await ctx.newPage();
  const errors = [];
  let hits = 0;
  p.on('pageerror', e => errors.push(e.message));
  const slow = () => p.route('**/api/db/rpc/engagement_state', async r => { await new Promise(res => setTimeout(res, 4000)); hits++; await r.continue(); });
  if (mode === 'login') await slow();
  await login(p, key);
  if (mode === 'hard') await slow();
  const t0 = Date.now(), seen = [];
  let skeleton = false, shot = false;
  if (mode === 'hard') await p.goto(`${base}/account/?tab=${tab}`, {waitUntil:'commit'});
  else await p.locator(`main .ma-tab[href="/account/?tab=${tab}"]`).click();
  while (Date.now() - t0 < 3000) {
    const s = await p.evaluate(() => ({bad: (document.querySelector('main')?.innerText || '').includes('მიუწვდომელია'), skel: !!document.querySelector('main .ma-loading--compact')})).catch(() => ({bad:false, skel:false}));
    if (s.bad) seen.push(Date.now() - t0);
    if (s.skel) { skeleton = true; if (shots && !shot) { shot = true; await p.addStyleTag({content:'nextjs-portal{display:none!important}'}); await p.screenshot({path:path.join(out,'profile-loading-1440.png'), fullPage:true}); } }
    await p.waitForTimeout(100);
  }
  const ready = tab === 'profile' ? 'main form' : 'main .account-wide';
  await p.waitForFunction(s => document.querySelector(s) && !document.querySelector('main [aria-busy="true"]'), ready, {timeout:60000});
  const finalBad = (await p.locator('main').innerText()).includes('მიუწვდომელია');
  if (shots) { await p.addStyleTag({content:'nextjs-portal{display:none!important}'}); await p.waitForTimeout(300); await p.screenshot({path:path.join(out,'profile-ready-1440.png'), fullPage:true}); }
  const ok = !seen.length && !finalBad && !errors.length;
  if (!ok) failed = true;
  console.log(safe(`${ok ? 'PASS' : 'FAIL'} ${key} ?tab=${tab} (${mode}): unavailable-hits=${seen.length} skeleton-seen=${skeleton} final-unavailable=${finalBad} pageerrors=${errors.length} delayed-rpc=${hits}`));
  await ctx.close();
}

try {
  await check('supply', 'profile', 'login', true);
  await check('supply', 'saved', 'login');
  await check('supply', 'profile', 'hard');
  await check('hotel', 'profile', 'login');
  await check('hotel', 'saved', 'login');
} catch (e) { failed = true; console.error(safe(e.stack || e)); }
await browser.close();
process.exit(failed ? 1 : 0);
