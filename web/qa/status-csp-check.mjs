// P12 T12.3d: 404/error screenshots + CSP check (console must have 0 CSP violations).
// Run: QA_ORIGIN=http://localhost:3001 node qa/status-csp-check.mjs
// The error shot needs a temporary trigger: in requests/view/page.tsx throw when searchParams has __err
// (add it for the run, remove after); without it the error step fails.
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
const safe = v => secrets.reduce((t, s) => t.replaceAll(s, '[redacted]'), String(v));
const out = path.join(root, 'qa/shots/ideal-0924');
fs.mkdirSync(out, {recursive:true});
const csp = [], pageErrors = [], failed = [];
const browser = await chromium.launch({headless:true, executablePath});
const ctx = await browser.newContext({viewport:{width:1440,height:1000}});
const p = await ctx.newPage();
p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) csp.push(`${p.url()} :: ${safe(t)}`); });
p.on('pageerror', e => { if (!/QA_TEMP_ERROR/.test(e.message)) pageErrors.push(safe(e.message)); });
p.on('requestfailed', r => { if (!/_rsc|webpack-hmr|__nextjs/.test(r.url())) failed.push(`${r.url()} ${r.failure()?.errorText}`); });
const hide = () => p.addStyleTag({content:'nextjs-portal{display:none!important}'});
async function visit(route) { await p.goto(base+route, {waitUntil:'networkidle'}); await p.waitForTimeout(800); }

try {
  for (const r of ['/', '/requests/', '/companies/', '/terms/', '/requests/new/']) await visit(r);
  // Detail pages: first request / company, photos load from Vercel Blob.
  await visit('/requests/');
  const reqHref = await p.locator('a[href*="/requests/view/?id="]').first().getAttribute('href');
  await visit(reqHref);
  const imgs = await p.evaluate(() => [...document.images].map(i => ({src:i.currentSrc||i.src, ok:i.complete && i.naturalWidth>0})));
  const blob = imgs.filter(i => /blob\.vercel-storage/.test(i.src));
  console.log('request detail images', imgs.length, 'blob', blob.length, 'broken', imgs.filter(i=>!i.ok && i.src).length);
  const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/wa\.me|google\.com\/maps/.test(h)));
  console.log('external links on request', links.map(l=>new URL(l).host));
  await visit('/companies/');
  const coHref = await p.locator('a[href*="/companies/view/?id="]').first().getAttribute('href');
  await visit(coHref);
  const maps = await p.evaluate(() => [...document.querySelectorAll('a[href*="google.com/maps"]')].length);
  console.log('maps links on company', maps);
  // Neon Auth: sign in through the real form (browser → neonauth host).
  const key = Object.keys(ledger.accounts)[0];
  await visit('/account/');
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  await p.waitForTimeout(1500);
  console.log('signed in as', key);
  // 404
  const res = await p.goto(base+'/nosuch/', {waitUntil:'networkidle'});
  assert.equal(res.status(), 404);
  assert.equal(await p.locator('main h1').innerText().then(t=>t.trim()), 'გვერდი ვერ მოიძებნა');
  await p.evaluate(() => document.fonts.ready); await hide(); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,'not-found-1440.png'), fullPage:true});
  await p.setViewportSize({width:390,height:844});
  await p.screenshot({path:path.join(out,'not-found-390.png'), fullPage:true});
  await p.setViewportSize({width:1440,height:1000});
  // error boundary (temporary trigger)
  await p.goto(base+'/requests/view/?__err=1', {waitUntil:'networkidle'});
  await p.waitForSelector('main h1');
  assert.equal(await p.locator('main h1').innerText().then(t=>t.trim()), 'გვერდი ვერ ჩაიტვირთა');
  assert(await p.locator('header').count() > 0, 'header kept');
  await p.evaluate(() => document.fonts.ready); await hide(); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,'error-1440.png'), fullPage:true});
  await p.setViewportSize({width:390,height:844});
  await p.screenshot({path:path.join(out,'error-390.png'), fullPage:true});
} finally {
  await browser.close();
}
console.log('CSP violations', csp.length); csp.forEach(c=>console.log('  ', c));
console.log('page errors', pageErrors.length); pageErrors.forEach(c=>console.log('  ', c));
console.log('failed requests', failed.length); failed.forEach(c=>console.log('  ', c));
