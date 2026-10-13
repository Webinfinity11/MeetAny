import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const phase = process.argv[2] || 'after';
const origin = 'http://localhost:3703', auth = 'http://127.0.0.1:3713';
const user = '3d12ff1f-0d72-4a53-a92f-1830cfd5b290';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const rows = [];
for (const role of (process.argv[3] ? [process.argv[3]] : ['guest', 'company'])) for (const width of [1440, 390, 360]) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: {width, height: 900} });
  const profile = role === 'client' ? 'a1b3d831-b513-4d96-a4ff-b7cdf19d8f17' : user;
  const jwt = role !== 'guest' ? (await (await fetch(`${auth}/__mint?sub=${profile}`)).json()).token : null;
  await context.route(`${auth}/**`, route => route.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? {'set-auth-jwt': jwt} : {})}, json: route.request().url().endsWith('/get-session') ? (jwt ? {user: {id: profile, email: 'qa@local.test', name: 'QA'}} : null) : {token: jwt}}));
  await context.addInitScript(signed => { localStorage.setItem('meetany.theme', 'blue'); if (signed) localStorage.setItem('meetany.session', '1'); }, !!jwt);
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for (const path of role === 'guest' && phase === 'after' ? ['/requests/', '/companies/', '/'] : ['/requests/']) {
    await page.goto(origin + path); await page.locator('article').first().waitFor(); await page.waitForTimeout(1800);
    let maxPrimary = 0;
    for (const article of await page.locator('article').all()) { await article.evaluate(e=>e.scrollIntoView({block:'center'})); await page.waitForTimeout(120); maxPrimary = Math.max(maxPrimary, await page.locator('.ma-btn--primary,.ma-btn--accent').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width && r.height && r.top<innerHeight && r.bottom>0;}).length)); }
    await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const visible = e => {const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.top<innerHeight && r.bottom>0 && r.left<innerWidth && r.right>0 && getComputedStyle(e).visibility!=='hidden';};
      return {primary: [...document.querySelectorAll('.ma-btn--primary,.ma-btn--accent')].filter(visible).map(e=>e.textContent), overflow: Math.max(0,document.documentElement.scrollWidth-innerWidth), offerActions: document.querySelectorAll('[data-request-id] a[href*="/offers/new/"]').length, cards: document.querySelectorAll('[data-request-id]').length};
    });
    const name = path === '/' ? 'home' : path.replaceAll('/', '');
    if (path === '/requests/') await page.locator('[data-request-id]').first().screenshot({path:`qa/p7-card/shots/${phase}-${role}-card-${width}.png`});
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({path:`qa/p7-card/shots/${phase}-${role}-${name}-${width}.png`, fullPage:true});
    if (path === '/requests/') {
      await page.locator('[data-request-id]').first().scrollIntoViewIfNeeded();
      metrics.scrolledPrimary = await page.locator('.ma-btn--primary,.ma-btn--accent').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width && r.height && r.top<innerHeight && r.bottom>0;}).map(e=>e.textContent));
      const fact = page.locator('[data-request-id]').first().locator('li').first();
      const box = await fact.boundingBox(); await page.mouse.click(box.x + box.width/2, box.y + box.height/2); await page.waitForURL('**/requests/view/?id=*');
      metrics.cardClick = true;
    }
    rows.push({role,width,path,maxPrimary,...metrics,errors:[...errors]});
    if (role === 'client') assert.equal(metrics.offerActions, 0);
    assert.equal(metrics.overflow, 0); assert.equal(errors.length, 0);
    if (phase === 'after' && path === '/requests/') { assert.ok(maxPrimary <= 1); assert.ok(metrics.primary.length <= 1); assert.ok(metrics.scrolledPrimary.length <= 1); if (role === 'company') assert.ok(metrics.offerActions > 0); }
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(`qa/p7-card/${phase}.json`, JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));
