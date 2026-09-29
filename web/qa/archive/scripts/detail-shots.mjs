// Detail pages on the registry design system (P11 T11.5a). Run: node qa/detail-shots.mjs (dev :3001)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/ideal-0924');
const errors = [];
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});

async function go(p, route) {
  await p.goto(base+route, {waitUntil:'networkidle'});
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  await p.evaluate(async () => {await document.fonts.ready; await Promise.all([...document.images].map(i => {i.loading='eager'; return i.decode().catch(()=>{});}));});
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(500);
}
// Left text edge of the first text node, so padding/indent differences show up.
const measure = () => {
  const x = e => {if(!e)return null;const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()?1:3});const t=w.nextNode();if(!t)return null;const r=document.createRange();r.selectNodeContents(t);return Math.round(r.getClientRects()[0]?.left??0);};
  const band = document.querySelector('.r2-band');
  const next = band?.nextElementSibling;
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    eyebrow: document.querySelectorAll('.r2-band .ma-eyebrow').length,
    revealedNumber: document.querySelectorAll('[data-contact-action=call]').length,
    back: x(document.querySelector('.ma-back')),
    h1: x(band?.querySelector('h1')),
    firstSection: x(document.querySelector('main section h2')),
    bandBottomBorder: band ? getComputedStyle(band).borderBottomWidth : null,
    nextTopBorder: next ? getComputedStyle(next).borderTopWidth : null,
    bandHeight: band ? Math.round(band.getBoundingClientRect().height) : null,
  };
};
async function shot(p, name) {
  const m = await p.evaluate(measure);
  assert.equal(m.overflow, 0, `${name}: overflow`);
  assert.equal(m.eyebrow, 0, `${name}: eyebrow`);
  assert.equal(m.revealedNumber, 0, `${name}: number revealed`);
  assert.equal(m.nextTopBorder, '0px', `${name}: double line under the head`);
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage:true});
  console.log(name, JSON.stringify(m));
}
function watch(p) {p.on('pageerror', e => errors.push(e.message));return p;}

try {
  const guest = await browser.newContext();
  const page = watch(await guest.newPage());
  await go(page, '/requests/');
  const request = await page.locator('a[href^="/requests/view/?id="]').first().getAttribute('href');
  await go(page, '/companies/');
  const company = await page.locator('a[href^="/companies/view/?id="]').first().getAttribute('href');
  for (const [w,h] of [[1440,1000],[390,844]]) {
    await page.setViewportSize({width:w,height:h});
    for (const [name, route] of [['request-view', request], ['company-view', company]]) {
      await go(page, route);
      await page.locator('.ma-call').first().waitFor({timeout:30000});
      await shot(page, `${name}-${w}`);
    }
  }
  await guest.close();

  const ctx = await browser.newContext({viewport:{width:1440,height:1000}});
  const p = watch(await ctx.newPage());
  await go(p, '/account/');
  await p.locator('#login-email').fill('demo-supply@meetany.ge');
  await p.locator('#login-password').fill(ledger.accounts.supply.password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  await go(p, '/requests/');
  const hrefs = await p.locator('a[href^="/requests/view/?id="]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')))].slice(0, 12));
  let found = false;
  for (const href of hrefs) {
    await go(p, href);
    if (await p.locator('.request-detail-aside button[type=submit]').count()) {found = true; break;}
  }
  assert(found, 'no open request without an offer from the demo company');
  await shot(p, 'request-view-company-1440');
  await ctx.close();
  assert.deepEqual(errors, []);
  console.log('pageerror 0');
} catch (err) {
  console.error('pageerrors:', errors.map(safe));
  throw new Error(safe(err.message));
} finally {
  await browser.close();
}
