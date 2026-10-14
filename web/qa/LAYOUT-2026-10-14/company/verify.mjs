// Local P8 company profile checks; save is restored to its original state.
// BASE=http://127.0.0.1:3447 AUTH=http://127.0.0.1:4447 node qa/LAYOUT-2026-10-14/company/verify.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://127.0.0.1:3447';
const AUTH = process.env.AUTH || 'http://127.0.0.1:4447';
for (const url of [BASE, AUTH]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const out = 'qa/LAYOUT-2026-10-14/company';
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e', second: '3d12ff1f-0d72-4a53-a92f-1830cfd5b290' };
const result = { pages: [], dialogs: [], actions: [], overlays: [], requestPixels: [], errors: [] };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
async function contextFor(role, width) {
  const jwt = role === 'guest' ? null : (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block' });
  await context.route(`${AUTH}/**`, route => {
    const url = route.request().url();
    if (url.includes('/.well-known/')) return route.continue();
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? { 'set-auth-jwt': jwt } : {}) }, json: url.includes('/get-session') ? (jwt ? { user: { id: ids[role], name: 'QA', email: 'qa@local.test' } } : null) : { token: jwt } });
  });
  await context.route(/https:\/\/.*\/auth\//, route => route.abort());
  await context.addInitScript(({ signedIn }) => { localStorage.setItem('meetany.theme', 'blue'); if (signedIn) localStorage.setItem('meetany.session', '1'); }, { signedIn: !!jwt });
  return context;
}
async function settle(page) {
  await page.locator('main h1').waitFor();
  await page.waitForFunction(() => ![...document.querySelectorAll('main [aria-busy=true],main [class*=Skeleton]')].some(el => el.getClientRects().length));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
}
async function dialog(page, name, opener, meta) {
  await opener.focus();
  await page.keyboard.press('Enter');
  const modal = page.locator('dialog[open]').last();
  await modal.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await modal.evaluate(el => el.contains(document.activeElement)), `${name} initial focus`);
  const modalMode = await modal.evaluate(el => el.matches(':modal'));
  const count = await modal.locator('a[href],button,input,select,textarea,[tabindex]').count();
  if (modalMode) {
  for (let i = 0; i < count + 2; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await modal.evaluate(el => el.contains(document.activeElement)), `${name} Tab`);
  }
  await page.keyboard.press('Shift+Tab');
  assert.ok(await modal.evaluate(el => el.contains(document.activeElement)), `${name} Shift+Tab`);
  }
  if (name === 'gallery') {
    const before = await modal.locator('.company-viewer__count').innerText();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await modal.locator('.company-viewer__count').innerText(), before);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await modal.locator('.company-viewer__count').innerText(), before);
  }
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const serious = await page.evaluate(async () => (await window.axe.run()).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, nodes: v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) })));
  assert.deepEqual(serious, [], `${name} axe`);
  if (meta.width === 390) await page.screenshot({ path: `${out}/after/${meta.role}-${name}-${meta.width}.png` });
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  assert.ok(await opener.evaluate(el => el === document.activeElement), `${name} returned focus`);
  result.dialogs.push({ ...meta, name, focusTrap: modalMode, escape: true, focusReturn: true, serious: 0 });
}
async function overlays(page, meta) {
  await page.evaluate(() => scrollTo(0, 0));
  for (const label of ['შეტყობინებები', 'პროფილი', 'მენიუ']) {
    const opener = page.locator(`header button[aria-label="${label}"]`).first();
    if (!await opener.count() || !await opener.isVisible()) continue;
    await opener.click();
    await page.waitForTimeout(200);
    const hits = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('dialog[open],header [role=menu],header [class*=popover],header [class*=menu]')].filter(e => {
        const r = e.getBoundingClientRect(); return r.height > 40 && r.top >= 0 && getComputedStyle(e).visibility !== 'hidden';
      });
      const open = candidates.sort((a,b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
      if (!open) return { found: false, overlaps: [] };
      const r = open.getBoundingClientRect(), overlaps = new Set();
      for (let y = r.top + 8; y < Math.min(r.bottom,innerHeight) - 4; y += 10) for (let x = r.left + 8; x < Math.min(r.right,innerWidth) - 4; x += 24) {
        const e = document.elementFromPoint(x,y);
        if (e && !open.contains(e) && !e.closest('header[class*=Header_header]')) overlaps.add(`${e.tagName}.${String(e.className).slice(0,40)}`);
      }
      return { found: true, overlaps: [...overlaps] };
    });
    assert.ok(hits.found, `${label} overlay present`);
    assert.deepEqual(hits.overlaps, [], `${label} overlay`);
    result.overlays.push({ ...meta, label, ...hits });
    await page.keyboard.press('Escape');
  }
}
try {
  for (const role of ['guest', 'client']) for (const width of [320,390,1440]) {
    const context = await contextFor(role,width), page = await context.newPage();
    const meta = { role,width };
    page.on('pageerror', error => result.errors.push({ ...meta, message: error.message }));
    await page.goto(`${BASE}/companies/view/?id=${ids.company}`);
    await settle(page);
    await page.getByRole('button',{name:'მიწერა',exact:true}).waitFor();
    await page.waitForFunction(() => !document.querySelector('[aria-label="კომპანიის შენახვა"],[aria-label="შენახვის გაუქმება"]')?.disabled);
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('.company-profile'), h1 = root.querySelector('h1'), hero = root.querySelector('header');
      const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const actions = [...hero.querySelectorAll('a,button')].filter(visible).map(e => ({ label: e.getAttribute('aria-label') || e.textContent.trim(), height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width }));
      const photos = [...root.querySelectorAll('img')].filter(visible).map(e => ({ src: e.getAttribute('src'), loaded: e.complete && e.naturalWidth > 0 }));
      const imageOverlaps = [...root.querySelectorAll('[class*=productTile]')].map(e => {
        const img=e.querySelector('img'),copy=e.querySelector('[class*=productCopy]');
        return img && copy ? Math.max(0,img.getBoundingClientRect().bottom-copy.getBoundingClientRect().top) : 0;
      });
      return { height: document.documentElement.scrollHeight, overflow: Math.max(0,document.documentElement.scrollWidth-innerWidth), titleTop: h1.getBoundingClientRect().top, titleSize: getComputedStyle(h1).fontSize, primary: [...root.querySelectorAll('.ma-btn--primary')].filter(visible).length, actions, photos, imageOverlaps, panelWidth: root.querySelector('aside')?.getBoundingClientRect().width };
    });
    assert.equal(metrics.overflow,0); assert.equal(metrics.primary,1); assert.ok(metrics.actions.every(a => a.height >= 44 && a.width >= 44));
    assert.ok(metrics.imageOverlaps.every(n => n === 0), 'product images overlap copy');
    if (width === 390) assert.ok(metrics.titleTop <= 120, 'title in first 120px');
    if (width === 1440) assert.equal(metrics.panelWidth,320);
    result.pages.push({ ...meta, ...metrics });
    await dialog(page,'gallery',page.locator('button[class*=galleryTile]').first(),meta);
    await dialog(page,'product',page.locator('button[class*=productTile]').first(),meta);
    if (role === 'guest') {
      await dialog(page,'save-auth',page.getByRole('button',{name:'კომპანიის შენახვა',exact:true}),meta);
      await dialog(page,'message-auth',page.getByRole('button',{name:'მიწერა',exact:true}),meta);
    } else {
      await dialog(page,'message-client',page.getByRole('button',{name:'მიწერა',exact:true}),meta);
      const save=page.locator('button[aria-pressed][title="შენახვა"],button[aria-pressed][title="შენახულია"]');
      const original=await save.getAttribute('aria-pressed');
      await save.click(); await page.waitForFunction(value => document.querySelector('button[aria-pressed][title="შენახვა"],button[aria-pressed][title="შენახულია"]')?.getAttribute('aria-pressed') !== value, original);
      await save.click(); await page.waitForFunction(value => document.querySelector('button[aria-pressed][title="შენახვა"],button[aria-pressed][title="შენახულია"]')?.getAttribute('aria-pressed') === value, original);
      result.actions.push({ ...meta, saveRestored: true });
      await overlays(page,meta);
    }
    const cta=page.getByRole('link',{name:'ფასის მოთხოვნა',exact:true});
    assert.ok((await cta.getAttribute('href')).includes(`company=${ids.company}`));
    await cta.click(); await page.waitForURL('**/requests/new/**');
    assert.equal(new URL(page.url()).searchParams.get('company'),ids.company);
    result.actions.push({ ...meta, requestNavigation: true });
    await context.close();
  }
  for (const width of [390,1440]) {
    const context=await contextFor('guest',width),page=await context.newPage();
    await page.goto(`${BASE}/companies/view/?id=${ids.second}`); await settle(page);
    assert.ok(await page.locator('button[class*=productTile]').count()); assert.ok(await page.locator('button[class*=galleryTile]').count());
    await page.screenshot({path:`${out}/after/guest-company-second-${width}.png`,fullPage:true});
    result.pages.push({role:'guest',width,company:ids.second,overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth))});
    await dialog(page,'product-second',page.locator('button[class*=productTile]').first(),{role:'guest',width});
    await context.close();
  }
  for (const width of [1440,390]) {
    const name=`guest-request-view-${width}.png`,after=PNG.sync.read(fs.readFileSync(`${out}/after/${name}`));
    for (const [source,dir] of [['local-baseline',`${out}/baseline`],['detail-after','qa/LAYOUT-2026-10-14/detail/after']]) {
      const before=PNG.sync.read(fs.readFileSync(`${dir}/${name}`));
      const sameSize=before.width===after.width&&before.height===after.height;
      const pixels=sameSize?pixelmatch(before.data,after.data,null,after.width,after.height,{threshold:0}):null;
      result.requestPixels.push({width,source,sameSize,beforeHeight:before.height,afterHeight:after.height,pixels});
      if(source==='local-baseline') assert.equal(pixels,0,`request ${width} pixel equality`);
    }
  }
  assert.deepEqual(result.errors,[]);
} catch(error) { result.errors.push({message:error.message,stack:error.stack});process.exitCode=1; }
finally { fs.writeFileSync(`${out}/verification.json`,JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify(result,null,2)); }
