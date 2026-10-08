// მკაცრი შედარების კადრები: classic თემა, 1200 და 390, fullPage. გამოყენება: node shoot.mjs <group,...>  groups: public,account,onboard,flow,deal,all
// deal ჯგუფი ბაზას ცვლის (ერთი ახალი შეთავაზება + ერთი გარიგება სრული ციკლით) — მხოლოდ შეგნებულად.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const origin = process.env.QA_ORIGIN || 'http://localhost:3001';
const out = process.env.QA_OUT || '/tmp/meetany-qa/strict/site';
fs.mkdirSync(out, { recursive: true });
const groups = (process.argv[2] || 'public,account,onboard,flow').split(',');
const THEME = process.env.QA_THEME || 'classic';
const WIDTHS = (process.env.QA_WIDTHS || '1200,390').split(',').map(Number);
const has = g => groups.includes('all') || groups.includes(g);
const ledger = JSON.parse(fs.readFileSync('/tmp/meetany-qa/env/DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const env = fs.readFileSync('/tmp/meetany-qa/env/.env.local', 'utf8');
const auth = env.match(/^NEON_AUTH_BASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
const ids = { hotel: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', wood: '74cc28fc-47de-45cb-9563-93735b86855e', linen: '3d12ff1f-0d72-4a53-a92f-1830cfd5b290', cleaning: 'b69007dd-c2e2-46f0-8d77-72adb252ce47', pallets: '0101aaac-f4e6-4ed4-b1bd-5a52e0942db9', cups: 'e9cef3cf-80e1-40d3-aeb6-d34908743064', textile: 'd3c1691c-bf51-4398-81ec-dbd94bae0856', tables2: 'f04784a3-5684-4fb9-8e30-7fcd9f4ba043', doneDeal: '61ad53bb-cc1b-43c2-9404-48f1484d7444' };
const reportFile = path.join(out, 'report.json');
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { views: {}, log: [] };
const log = (...a) => { const s = a.join(' '); console.log(s); report.log.push(s); };
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const contexts = {};
async function ctxFor(role) {
  if (contexts[role]) return contexts[role];
  const stateFile = `/tmp/meetany-qa/state/${role}.json`;
  const base = { viewport: { width: 1200, height: 1000 }, reducedMotion: 'reduce' };
  let ctx = await browser.newContext(role === 'guest' || !fs.existsSync(stateFile) ? base : { ...base, storageState: stateFile });
  if (role !== 'guest') {
    const probe = await ctx.newPage();
    let ok = false;
    try { const r = await probe.request.get(auth + '/get-session', { timeout: 10000 }); ok = r.ok() && !!(await r.json().catch(() => null))?.user; } catch {}
    if (!ok) {
      await ctx.close(); ctx = await browser.newContext(base); const p = await ctx.newPage();
      const r = await p.request.post(auth + '/sign-in/email', { data: { email: `demo-${role}@meetany.ge`, password: ledger.accounts[role].password }, timeout: 15000 });
      if (!r.ok()) throw new Error(`sign-in ${role}: HTTP ${r.status()}`);
      await ctx.storageState({ path: stateFile }); fs.chmodSync(stateFile, 0o600); await p.close(); log(`sign-in ${role}: fresh`);
    } else { await probe.close(); log(`session ${role}: reused`); }
  }
  await ctx.addInitScript(t => { try { localStorage.setItem('meetany.theme', t); sessionStorage.clear(); } catch {} }, THEME);
  contexts[role] = ctx; return ctx;
}
async function token(role) { const ctx = await ctxFor(role); const p = await ctx.newPage(); const t = (await (await p.request.get(auth + '/token')).json()).token; await p.close(); return t; }
async function rpc(role, fn, args) { const ctx = await ctxFor(role); const p = await ctx.newPage(); const t = await token(role); const res = await p.request.post(`${origin}/api/db/rpc/${fn}`, { headers: { Authorization: `Bearer ${t}` }, data: args, timeout: 20000 }); const text = await res.text(); await p.close(); let data = null; try { data = JSON.parse(text); } catch {} if (res.status() >= 300) { log(`FAIL rpc ${fn} (${role}): ${res.status()} ${text.slice(0, 200)}`); return null; } log(`ok rpc ${fn} (${role}) stage=${data?.stage ?? '-'} rev=${data?.revision ?? '-'}`); return data; }
async function rest(role, q) { const ctx = await ctxFor(role); const p = await ctx.newPage(); const t = await token(role); const res = await p.request.get(`${origin}/api/db/${q}`, { headers: { Authorization: `Bearer ${t}` }, timeout: 20000 }); const d = await res.json().catch(() => null); await p.close(); return d; }
async function settle(page) {
  await page.waitForFunction(() => { const m = document.querySelector('main'); return !!m && m.innerText.trim().length > 0 && !document.querySelector('main [aria-busy="true"]'); }, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // lazy სურათების ჩასატვირთად გვერდი ბოლომდე გადავფურცლოთ და დავბრუნდეთ
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
  await page.waitForTimeout(600);
}
// name: artboard; role; route; width; prep(page) — optional interaction before the shot (modal opening etc.)
async function shot(name, role, route, prep, opts = {}) {
  const ctx = await ctxFor(role); let page = null;
  for (const width of WIDTHS) {
    const fresh = !opts.single || !page;
    if (fresh) { page = await ctx.newPage(); page._errs = { consoleErrors: [], pageErrors: [] }; page.on('pageerror', e => page._errs.pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') page._errs.consoleErrors.push(m.text().slice(0, 200)); }); }
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const key = `${name}-${width}`;
    try {
      if (fresh) { await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 }); await settle(page); if (prep) await prep(page, width); }
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(fresh ? 400 : 700);
      const st = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth, h1: document.querySelector('main h1')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '', url: location.pathname + location.search, dialog: !!document.querySelector('dialog[open], [role="dialog"]') }));
      await page.screenshot({ path: path.join(out, key + '.png'), fullPage: !st.dialog, animations: 'disabled' });
      const { consoleErrors, pageErrors } = page._errs;
      report.views[key] = { name, role, route, width, ...st, consoleErrors: [...consoleErrors], pageErrors: [...pageErrors], at: new Date().toISOString() };
      log(`${st.overflow || consoleErrors.length || pageErrors.length ? 'WARN' : 'ok  '} ${key} h1="${st.h1.slice(0, 40)}" dialog=${st.dialog} overflow=${st.overflow} console=${consoleErrors.length} page=${pageErrors.length}`);
    } catch (e) { report.views[key] = { name, role, route, width, error: e.message.split('\n')[0] }; log(`FAIL ${key} ${e.message.split('\n')[0]}`); }
    finally { if (!opts.single || width === WIDTHS[WIDTHS.length - 1]) { await page.close(); page = null; } save(); }
  }
}
const btn = (p, n) => p.getByRole('button', { name: n, exact: true });
const openFilters = async (p, w) => { if (w < 600) { const b = p.getByRole('button', { name: /ფილტრები/ }); if (await b.count()) { await b.first().click(); await p.locator('dialog[open], [role="dialog"]').first().waitFor({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(500); } } };
try {
  if (has('dealview')) { for (const [i, id] of (process.env.QA_DEAL_IDS || '').split(',').filter(Boolean).entries()) await shot(`deal-view-${i}`, 'hotel', `/deals/view/?id=${id}`); }
  if (has('opps')) await shot('opportunities', 'guest', '/requests/');
  if (has('sheet') || has('public')) await shot('sheet-filters', 'guest', '/requests/', openFilters);
  if (has('auth')) {
    await shot('modal-auth', 'guest', '/account/');
    await shot('modal-auth-cta', 'guest', `/requests/view/?id=${ids.cleaning}`, async p => { await btn(p, 'შეთავაზების გაგზავნა').first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
    await shot('modal-auth-register-company', 'guest', '/account/?tab=register&role=company');
    await shot('modal-auth-register-client', 'guest', '/account/?tab=register');
    await shot('modal-auth-reset', 'guest', '/account/?tab=reset');
  }
  if (has('public')) {
    await shot('home', 'guest', '/');
    await shot('opportunities', 'guest', '/requests/');
    await shot('request-detail', 'guest', `/requests/view/?id=${ids.cleaning}`);
    await shot('modal-auth', 'guest', '/account/');
    await shot('modal-auth-cta', 'guest', `/requests/view/?id=${ids.cleaning}`, async p => { await btn(p, 'შეთავაზების გაგზავნა').first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
    await shot('company-profile', 'guest', `/companies/view/?id=${ids.wood}`);
    await shot('states', 'guest', '/dev/ui/');
  }
  if (has('account')) {
    const openThread = async p => { const row = p.locator('[data-conversations] li button').first(); if (await row.count()) { await row.click(); await p.waitForTimeout(1200); } };
    await shot('my-requests', 'hotel', '/account/?tab=requests');
    await shot('messages', 'hotel', '/account/?tab=messages', openThread);
    await shot('notifications', 'hotel', '/account/?tab=notifications');
    await shot('dashboard', 'wood', '/account/');
    await shot('dashboard-linen', 'linen', '/account/');
    await shot('my-offers', 'wood', '/account/?tab=offers');
    await shot('matching', 'wood', '/matching/');
    await shot('matching-linen', 'linen', '/matching/');
  }
  if (has('onboard')) for (const s of ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']) await shot(`onboard-${s}`, 'wood', `/onboarding/?step=${s}`);
  const fillStep1 = async p => {
    await p.locator('#title').fill('[strict-qa] სასტუმროსთვის 40 კომპლექტი თეთრეული');
    const cat = p.locator('#category').first(); await cat.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await p.locator('#body').fill('[strict-qa] სასტუმროს ნომრებისთვის გვჭირდება 40 კომპლექტი ბამბის თეთრეული (ზეწარი, ბალიშისპირი, საბნის პირი). მიწოდება თბილისში, ერთ პარტიად.');
    await p.locator('#quantity').fill('40');
  };
  const next = async p => { const b = p.locator('button[type="submit"][form="post-request-form"]').first(); await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click({ timeout: 8000 }).catch(() => b.evaluate(el => el.click())); await p.waitForTimeout(900); };
  const fillStep2 = async p => { await p.locator('#neededBy').fill('2026-11-20'); await p.locator('#addressNote').fill('ვაკე, ჭავჭავაძის გამზ.').catch(() => {}); };
  if (has('post')) {
    await shot('post-details', 'hotel', '/requests/new/?step=1', fillStep1);
    await shot('post-delivery', 'hotel', '/requests/new/?step=1', async p => { await fillStep1(p); await next(p); await fillStep2(p); });
    await shot('post-review', 'hotel', '/requests/new/?step=1', async p => { await fillStep1(p); await next(p); await fillStep2(p); await next(p); });
  }
  if (has('flow')) {
    await shot('compare-offers', 'hotel', `/requests/compare/?id=${ids.cleaning}`);
    await shot('modal-select-offer', 'hotel', `/requests/compare/?id=${ids.cleaning}`, async p => { await btn(p, 'არჩევა').first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
    report.makeOfferRequest = ids.tables2; save();
    await shot('make-offer', 'wood', `/offers/new/?requestId=${ids.tables2}`);
  }
  const dealReq = process.env.QA_DEAL_REQUEST || ids.pallets; const buyer = process.env.QA_BUYER || 'hotel'; const only = has('newterms');
  if (has('deal') || has('dealcycle') || has('newterms') || has('publish')) {
    if (has('deal') || has('publish')) await shot('post-published', 'hotel', '/requests/new/?step=1', async p => { await fillStep1(p); await next(p); await fillStep2(p); await next(p); await next(p); await p.waitForFunction(() => /გამოქვეყნდა/.test(document.body.innerText), null, { timeout: 20000 }); }, { single: true });
    if (has('publish') && !has('deal')) throw Object.assign(new Error('publish done'), { done: true });
    const rid = only ? dealReq : ids.cups;
    if (has('deal') || only) await shot('modal-offer-sent', 'wood', `/offers/new/?requestId=${rid}`, async p => {
      await p.getByRole('button', { name: 'ჯამური', exact: true }).click().catch(() => {});
      await p.locator('#of-price').fill('2400'); await p.locator('#of-deliveryDays').fill('10');
      await p.getByRole('group', { name: 'გადახდის პირობები' }).getByRole('button').first().click().catch(() => {});
      await p.locator('#of-body').fill('[strict-qa] ბრენდირებული ქაღალდის ჭიქები 2000 ცალი — ბეჭდვა 2 ფერი, მიტანა თბილისში 10 დღეში.');
      await btn(p, 'შეთავაზების გაგზავნა').click(); await p.locator('dialog[open]').waitFor({ timeout: 20000 }); report.offerSentOn = rid; save();
    }, { single: true });
    const sent = (await rest(buyer, `offers?select=id,company_id,status,updated_at&request_id=eq.${dealReq}`) || []).find(o => o.company_id === ids.wood && o.status === 'sent');
    let deal = report.dealId ? await rpc(buyer, 'get_deal', { p_deal_id: report.dealId }) : null;
    if (!deal) { if (!sent) throw new Error('no sent wood offer on ' + dealReq); deal = await rpc(buyer, 'select_offer_deal', { p_offer_id: sent.id, p_expected_updated_at: sent.updated_at }); if (!deal) throw new Error('select failed'); report.dealId = deal.id; save(); }
    const d = report.dealId; const url = `/deals/view/?id=${d}`; log('DEAL', d, 'stage', deal.stage);
    if (deal.stage === 'selected') { await shot('deal-selected', buyer, url); deal = await rpc(buyer, 'advance_deal', { p_deal_id: d, p_stage: 'discuss', p_expected_revision: deal.revision }) || deal; }
    if (deal.stage === 'discuss') {
      await shot('modal-new-terms', 'wood', url, async p => { await p.getByRole('button', { name: /ახალი პირობებ/ }).first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
      if (only) throw Object.assign(new Error('newterms done'), { done: true });
      await shot('deal-discuss', buyer, url);
      deal = await rpc('wood', 'propose_deal_terms', { p_deal_id: d, p_expected_revision: deal.revision, p_total_price: 1800, p_quantity: 3, p_unit: 'pcs', p_delivery_days: 7, p_delivery_date: null, p_delivery_place: 'თბილისი', p_payment_terms: '50% წინასწარ · 50% მიწოდებისას', p_includes: ['ტრანსპორტირება', 'დატვირთვა'] }) || deal;
      deal = await rpc('wood', 'advance_deal', { p_deal_id: d, p_stage: 'terms', p_expected_revision: deal.revision }) || deal;
    }
    if (deal.stage === 'terms') {
      await shot('deal-terms', buyer, url);
      deal = await rpc('wood', 'confirm_deal_terms', { p_deal_id: d, p_expected_revision: deal.revision }) || deal;
      deal = await rpc(buyer, 'confirm_deal_terms', { p_deal_id: d, p_expected_revision: deal.revision }) || deal;
      deal = await rpc(buyer, 'advance_deal', { p_deal_id: d, p_stage: 'progress', p_expected_revision: deal.revision }) || deal;
    }
    if (deal.stage === 'progress') {
      await shot('deal-progress', buyer, url);
      await shot('modal-report-issue', buyer, url, async p => { await btn(p, 'პრობლემის შეტყობინება').first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
      deal = await rpc(buyer, 'advance_deal', { p_deal_id: d, p_stage: 'complete', p_expected_revision: deal.revision }) || deal;
    }
    if (deal.stage === 'complete') {
      if (deal.rating == null) await shot('modal-review', buyer, url, async p => { await btn(p, 'შეფასება').first().click(); await p.locator('dialog[open]').waitFor({ timeout: 8000 }); }, { single: true });
      deal = await rpc(buyer, 'rate_deal', { p_deal_id: d, p_rating: 5, p_review: 'ხარისხი 5 · ვადები 5 · კომუნიკაცია 4 · საიმედოობა 5 · კვლავ: დიახ. [strict-qa]', p_expected_revision: deal.revision }) || deal;
      await shot('deal-complete', buyer, url);
    }
  }
} catch (e) { if (e.done) log('STOP', e.message); else { log('ABORT', e.message); process.exitCode = 1; } }
finally { await browser.close(); save(); const bad = Object.values(report.views).filter(v => v.error || v.overflow || v.consoleErrors?.length || v.pageErrors?.length); log(`\nDONE views=${Object.keys(report.views).length} problems=${bad.length}`); }
