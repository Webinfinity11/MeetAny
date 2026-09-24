// P12 T12.3c: counts client /api/db calls. Read-only apart from mark_read on an already-read chat.
// Run: QA_ORIGIN=http://localhost:3001 node qa/client-calls.mjs [catalog|chat|phone]...
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const only = process.argv.slice(2);
const want = name => !only.length || only.includes(name);
const browser = await chromium.launch({headless:true, executablePath});
const errors = [];

function track(p) {
  const calls = [];
  p.on('request', r => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/db/')) return;
    const name = u.pathname.slice('/api/db/'.length) + (u.searchParams.get('select') === 'id,phone' ? '(phone)' : '');
    calls.push({name, at: Date.now()});
  });
  return calls;
}
const tally = calls => calls.reduce((m, c) => (m[c.name] = (m[c.name] || 0) + 1, m), {});

async function session(key) {
  const ctx = await browser.newContext({viewport:{width:1440, height:1000}});
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base+'/account/', {waitUntil:'networkidle'});
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('#login-email'), null, {timeout:60000});
  return {ctx, p};
}

try {
  if (want('catalog')) {
    const ctx = await browser.newContext({viewport:{width:1440, height:1000}});
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    const calls = track(p);
    await p.goto(base+'/requests/', {waitUntil:'networkidle'});
    await p.waitForTimeout(4000);
    console.log('catalog guest /requests/:', calls.length, JSON.stringify(tally(calls)));
    await ctx.close();
  }
  if (want('phone')) {
    const ctx = await browser.newContext({viewport:{width:1440, height:1000}});
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(base+'/requests/', {waitUntil:'networkidle'});
    const href = await p.locator('main a[href*="/requests/view/?id="]').first().getAttribute('href');
    const calls = track(p);
    const t0 = Date.now();
    await p.locator(`main a[href="${href}"]`).first().click();
    await p.locator('main h1').first().waitFor({timeout:30000});
    const h1 = Date.now() - t0;
    await p.locator('main button:has-text("ნომრის ნახვა")').first().waitFor({timeout:30000});
    const ms = Date.now() - t0;
    await p.waitForTimeout(2000);
    console.log('request detail (client nav): h1 after', h1, 'ms, phone button after', ms, 'ms; phone fetches', tally(calls)['profiles(phone)'] || 0);
    await ctx.close();
  }
  if (want('chat')) {
    const {ctx, p} = await session('hotel');
    await p.goto(base+'/account/?tab=messages', {waitUntil:'networkidle'});
    await p.locator('.inbox-row').first().waitFor({timeout:60000});
    await p.locator('.inbox-msg, .inbox-log__note').first().waitFor({timeout:30000});
    await p.waitForTimeout(6000); // first poll marks anything unread
    const calls = track(p);
    await p.waitForTimeout(30000);
    const t = tally(calls);
    console.log('open chat 30 s:', JSON.stringify(t), `(mark_read ${t['rpc/mark_read'] || 0} vs ${t['rpc/list_messages'] || 0} before: one per poll)`);
    await ctx.close();
  }
  assert.equal(errors.length, 0, 'pageerror: '+errors.join(' | '));
  console.log('PASS');
} catch (err) {
  console.error(String(err.message || err).replaceAll(/demo-\w+@/g, 'demo-*@'));
  process.exitCode = 1;
} finally { await browser.close(); }
