// ეტაპი 1, ფართობი „გარიგება“: მხოლოდ წაკითხვა. ყველა ჩაწერის RPC ქსელის დონეზე იბლოკება.
// გაშვება: node qa/PERFECTION-2026-10-12/scripts/deal.mjs  (web/-დან; სერვერი localhost:3300)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../../..');
const base = process.env.QA_BASE || 'http://localhost:3300';
const out = path.join(root, 'qa/PERFECTION-2026-10-12/before/deal');
fs.mkdirSync(out, { recursive: true });
const ledgerPath = ['../DEMO-ACCOUNTS.local.md', '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md']
  .map(p => path.resolve(root, p)).find(p => fs.existsSync(p));
const state = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);

// წაკითხვის RPC-ები; ყველაფერი დანარჩენი (advance_deal, confirm_deal_terms, select_offer_deal, send_message…) იბლოკება.
const READ = /^(get_|list_|compare_offers$|search|my_|public_|count_|company_features|company_business_features$|company_products$|request_preferences$|engagement_state$|request_detail|market_|bootstrap|admin_stats$|unread|notification_count)/;
const PHASE = process.env.PHASE || 'all';
// ცოცხალ ბაზაში owner_user/owner_company-ს გარიგება არ აქვთ; ეტაპები დემო ანგარიშებით (ledger) — თითო ეტაპზე ერთი გარიგება, ორივე მხარე.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
// 3300 სერვერი MEETANY_LOCAL_DATABASE_URL-ის ლოკალურ ასლს კითხულობს; მასში მხოლოდ discuss და complete ეტაპებია.
const STAGE_DEALS = [
  ['discuss', 'd8cba06d-5136-409d-bc21-68d81c5be4d4', 'owner_user', 'wood'],
  ['complete', '63d76320-70a5-4cf2-bd5a-dc4aa424a3bc', 'hotel', 'wood'],
];
const report = { base, generatedAt: new Date().toISOString(), blocked: [], rpcs: {}, pages: [] };
const VIEWPORTS = [{ w: 1440, h: 1000 }, { w: 390, h: 844 }];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const settle = async p => {
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.waitForFunction(() => { const m = document.querySelector('main'); return m && m.innerText.length > 20 && !m.querySelector('[aria-busy="true"]') && !m.innerText.includes('იტვირთება…'); }, null, { timeout: 30000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
};
async function audit(p, label) {
  return p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = [];
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') {
        const cs = getComputedStyle(el.parentElement || el);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') continue;
        over.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.left)}..${Math.round(r.right)} «${(el.innerText || '').slice(0, 40).replace(/\s+/g, ' ')}»`);
      }
    }
    const buttons = [...document.querySelectorAll('main button, main a.ma-btn, [role=dialog] button')].filter(b => b.offsetParent).map(b => ({ text: b.innerText.trim().replace(/\s+/g, ' ').slice(0, 50) || b.getAttribute('aria-label'), cls: String(b.className).slice(0, 80), h: Math.round(b.getBoundingClientRect().height) }));
    return { docOverflow: document.documentElement.scrollWidth - vw, over: over.slice(0, 12), h1: document.querySelector('main h1')?.innerText || '', text: (document.querySelector('main')?.innerText || '').slice(0, 6000), buttons };
  }).then(r => ({ label, ...r }));
}
async function shoot(p, name) {
  assert.equal(await p.locator('#login-password').count(), 0, 'Never capture password form');
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await p.screenshot({ path: path.join(out, name), fullPage: true });
}
async function both(p, name, url, extra) {
  for (const v of VIEWPORTS) {
    await p.setViewportSize({ width: v.w, height: v.h });
    const errors = []; const onErr = e => errors.push('pageerror: ' + e.message.slice(0, 200)); const onCon = m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); };
    p.on('pageerror', onErr); p.on('console', onCon);
    if (url) await p.goto(base + url, { waitUntil: 'domcontentloaded' });
    await settle(p);
    const a = await audit(p, `${name}-${v.w}`);
    await shoot(p, `${name}-${v.w}.png`);
    if (extra) a.extra = await extra(p, v.w).catch(e => ({ error: String(e.message).slice(0, 200) }));
    p.off('pageerror', onErr); p.off('console', onCon);
    report.pages.push({ ...a, url: url || p.url().replace(base, ''), errors });
  }
}
// მოდალი: გახსნა → სკრინი → ფოკუსი/ტექსტი → Escape → დახურვის შემოწმება. გაგზავნა არასოდეს.
async function modal(p, name, opener, w) {
  const btn = p.getByRole('button', { name: opener, exact: false }).first();
  if (!(await btn.count()) || !(await btn.isVisible()) || await btn.isDisabled()) return { name, skipped: 'ღილაკი არ ჩანს/გამორთულია' };
  await btn.click();
  const dlg = p.locator('[role=dialog], dialog[open]').last();
  await dlg.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(350);
  const info = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[role=dialog], dialog[open]')].pop();
    const ae = document.activeElement;
    return d ? { text: d.innerText.slice(0, 1500), focusInside: d.contains(ae), focused: ae ? `${ae.tagName} ${ae.getAttribute('aria-label') || ae.innerText?.slice(0, 30) || ''}` : null, buttons: [...d.querySelectorAll('button')].filter(b => b.offsetParent).map(b => ({ t: b.innerText.trim() || b.getAttribute('aria-label'), cls: String(b.className).slice(0, 60), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })), overflow: d.scrollWidth - d.clientWidth } : null;
  });
  await shoot(p, `${name}-${w}.png`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const closed = (await p.locator('[role=dialog]:visible, dialog[open]').count()) === 0;
  const back = await p.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.innerText?.slice(0, 30) || ''}`);
  return { name, ...info, escapeCloses: closed, focusAfterClose: back };
}

try {
  for (const key of PHASE === 'deals' ? [] : ['owner_user', 'owner_company']) {
    const account = state.accounts[key];
    assert(account?.email && account?.password, 'Missing ledger account');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.route('**/api/db/**', route => {
      const req = route.request(); const url = new URL(req.url());
      const m = url.pathname.match(/\/api\/db\/rpc\/([a-z0-9_]+)/);
      if (m) {
        report.rpcs[m[1]] = (report.rpcs[m[1]] || 0) + 1;
        if (!READ.test(m[1])) { report.blocked.push(`${key}: ${m[1]}`); return route.abort(); }
      } else if (req.method() !== 'GET' && req.method() !== 'HEAD' && !/\/api\/db\/(auth|session|token)/.test(url.pathname)) {
        report.blocked.push(`${key}: ${req.method()} ${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    await ctx.route('**/api/blob/**', route => route.request().method() === 'GET' ? route.continue() : route.abort());
    const p = await ctx.newPage();
    // RPC-ის შეცდომები (ტოკენები/პაროლები არ იწერება — მხოლოდ კოდი და მესიჯი).
    p.on('response', async res => {
      const m = res.url().match(/\/api\/db\/rpc\/([a-z0-9_]+)/);
      if (!m || res.status() < 400) return;
      const body = await res.json().catch(() => ({}));
      (report.rpcErrors ||= []).push({ role: key, rpc: m[1], status: res.status(), code: body?.code || null, message: String(body?.message || '').slice(0, 160), hint: body?.hint || null });
    });
    try {
      await p.goto(base + '/account/', { waitUntil: 'networkidle' });
      await p.locator('#login-email').fill(account.email);
      await p.locator('#login-password').fill(account.password);
      await p.locator('form button[type="submit"]').click();
      await p.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
      await settle(p);
      const tag = key === 'owner_user' ? 'buyer' : 'supplier';

      await both(p, `${tag}-mydeals`, '/account/?tab=deals');
      // list_my_deals შეიძლება ვერ ჩაიტვირთოს — ბმულები სხვა ჩანართებიდანაც გროვდება.
      const found = new Map();
      for (const tab of ['deals', 'notifications', 'overview', tag === 'buyer' ? 'requests' : 'offers']) {
        if (tab !== 'deals') { await p.goto(base + `/account/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await settle(p); }
        if (tab === 'notifications') await both(p, `${tag}-notifications`, null);
        if (tab === 'offers') await both(p, `${tag}-myoffers`, null);
        if (tab === 'requests') await both(p, `${tag}-myrequests`, null);
        for (const [id, ctxText] of await p.$$eval('main a[href*="/deals/view"]', as => as.map(a => [new URL(a.href).searchParams.get('id'), (a.closest('li,article')?.innerText || a.innerText).replace(/\s+/g, ' ').slice(0, 160)])))
          if (id && !found.has(id)) found.set(id, `${tab}: ${ctxText}`);
      }
      const deals = [...found.entries()];
      report[`${tag}Deals`] = deals;

      for (const [id] of deals) {
        if (!id) continue;
        const short = id.slice(0, 8);
        await both(p, `${tag}-deal-${short}`, `/deals/view/?id=${id}`, async (pg, w) => {
          const res = [];
          for (const [n, label] of [['newterms', 'ახალი პირობები'], ['change', 'ცვლილების შეთავაზება'], ['issue', 'პრობლემის შეტყობინება'], ['review', 'შეფასება'], ['cancel', 'გარიგების გაუქმება']]) {
            if (n === 'review' && !(await pg.getByRole('button', { name: 'შეფასება', exact: true }).count())) continue;
            res.push(await modal(pg, `${tag}-deal-${short}-modal-${n}`, n === 'review' ? /^შეფასება$/ : label, w));
          }
          // საერთო ფაილების პანელი (details) — მხოლოდ გახსნა.
          const sf = pg.locator('summary[aria-label="საერთო ფაილები"]').first();
          if (await sf.count()) { await sf.click(); await pg.waitForTimeout(800); await shoot(pg, `${tag}-deal-${short}-sharedfiles-${w}.png`); res.push({ name: 'sharedfiles', text: await pg.locator('summary[aria-label="საერთო ფაილები"] + div').innerText().catch(() => '') }); await sf.click(); }
          return res;
        });
      }

      if (tag === 'buyer') {
        const reqIds = [...new Set(await (async () => { await p.goto(base + '/account/?tab=requests', { waitUntil: 'domcontentloaded' }); await settle(p); return p.$$eval('main a[href*="/requests/view"]', as => as.map(a => new URL(a.href).searchParams.get('id')).filter(Boolean)); })())].slice(0, 6);
        report.buyerRequests = reqIds;
        for (const rid of reqIds) {
          await both(p, `buyer-compare-${rid.slice(0, 8)}`, `/requests/compare/?id=${rid}`, async (pg, w) => [await modal(pg, `buyer-compare-${rid.slice(0, 8)}-modal-select`, /^არჩევა$/, w)]);
        }
        // ChooseOfferSheet: მოთხოვნის გვერდზე „გარიგების გახსნა“ ან „არჩევა“ ხსნის მხოლოდ დადასტურების ფანჯარას.
        for (const rid of reqIds.slice(0, 4)) {
          await both(p, `buyer-request-${rid.slice(0, 8)}`, `/requests/view/?id=${rid}`, async (pg, w) => [await modal(pg, `buyer-request-${rid.slice(0, 8)}-choosesheet`, /^(გარიგების გახსნა|არჩევა)$/, w)]);
        }
      }
      await both(p, `${tag}-messages`, '/account/?tab=messages', async (pg, w) => {
        const first = pg.locator('main [role=listbox] [role=option], main a[href*="tab=messages&c="], main button[class*="conversation"]').first();
        if (await first.count()) { await first.click(); await pg.waitForTimeout(1500); }
        const sf = pg.locator('summary[aria-label="საერთო ფაილები"]').first();
        let files = null;
        if (await sf.count()) { await sf.click(); await pg.waitForTimeout(800); files = await pg.locator('summary[aria-label="საერთო ფაილები"] + div').innerText().catch(() => ''); }
        await shoot(pg, `${tag}-messages-open-${w}.png`);
        return { opened: !!(await first.count()), files };
      });
    } finally { await ctx.close(); }
  }
  // ფაზა B: გარიგების გვერდი თითო ეტაპზე, მყიდველისა და მომწოდებლის ხედით.
  const byAccount = {};
  for (const [stage, id, buyer, supplier] of STAGE_DEALS) { (byAccount[buyer] ||= []).push([stage, id, 'buyer']); (byAccount[supplier] ||= []).push([stage, id, 'supplier']); }
  for (const [key, list] of Object.entries(PHASE === 'owners' ? {} : byAccount).filter(([k]) => !ONLY || ONLY.includes(k))) {
    const account = { email: `demo-${key}@meetany.ge`, ...state.accounts[key] }; // owner_* ledger-ში საკუთარი email აქვს
    assert(account?.email && account?.password, 'Missing ledger account');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.route('**/api/db/**', route => {
      const req = route.request(); const url = new URL(req.url());
      const m = url.pathname.match(/\/api\/db\/rpc\/([a-z0-9_]+)/);
      if (m) { report.rpcs[m[1]] = (report.rpcs[m[1]] || 0) + 1; if (!READ.test(m[1])) { report.blocked.push(`${key}: ${m[1]}`); return route.abort(); } }
      else if (req.method() !== 'GET' && req.method() !== 'HEAD') { report.blocked.push(`${key}: ${req.method()} ${url.pathname}`); return route.abort(); }
      return route.continue();
    });
    await ctx.route('**/api/blob/**', route => route.request().method() === 'GET' ? route.continue() : route.abort());
    const p = await ctx.newPage();
    p.on('response', async res => { const m = res.url().match(/\/api\/db\/rpc\/([a-z0-9_]+)/); if (!m || res.status() < 400) return; const body = await res.json().catch(() => ({})); (report.rpcErrors ||= []).push({ role: key, rpc: m[1], status: res.status(), code: body?.code || null, message: String(body?.message || '').slice(0, 160) }); });
    try {
      await p.goto(base + '/account/', { waitUntil: 'networkidle' });
      await p.locator('#login-email').fill(account.email);
      await p.locator('#login-password').fill(account.password);
      await p.locator('form button[type="submit"]').click();
      const ok = await p.locator('#login-email').waitFor({ state: 'detached', timeout: 30000 }).then(() => true, () => false);
      if (!ok) { (report.loginFailed ||= []).push({ key, alert: (await p.locator('[role=alert]').allInnerTexts().catch(() => [])).join(' | ').slice(0, 200) }); continue; }
      await settle(p);
      for (const [stage, id, side] of list) {
        await both(p, `stage-${stage}-${side}`, `/deals/view/?id=${id}`, async (pg, w) => {
          const res = [];
          for (const [n, label] of [['newterms', /^ახალი პირობები$/], ['agreed', /^პირობები შეთანხმებულია$/], ['change', /^ცვლილების შეთავაზება$/], ['issue', /^პრობლემის შეტყობინება$/], ['review', /^შეფასება$/], ['cancel', /^გარიგების გაუქმება$/]])
            if (await pg.getByRole('button', { name: label }).count()) res.push(await modal(pg, `stage-${stage}-${side}-modal-${n}`, label, w));
          const sf = pg.locator('summary[aria-label="საერთო ფაილები"]').first();
          if (await sf.count()) { await sf.click(); await pg.waitForTimeout(1200); await shoot(pg, `stage-${stage}-${side}-sharedfiles-${w}.png`); res.push({ name: 'sharedfiles', text: await pg.locator('summary[aria-label="საერთო ფაილები"] + div').innerText().catch(() => '') }); await sf.click(); }
          return res;
        });
      }
      if (list.some(([, , side]) => side === 'buyer')) await both(p, `demo-${key}-mydeals`, '/account/?tab=deals');
    } finally { await ctx.close(); }
  }
  // dev/qa-layout: ერთი და იგივე მოდალები სატესტო მონაცემებით (ჩაწერის გარეშე).
  const ctx = await browser.newContext();
  await ctx.route('**/api/db/rpc/**', route => READ.test(new URL(route.request().url()).pathname.split('/').pop()) ? route.continue() : route.abort());
  const p = await ctx.newPage();
  for (const v of PHASE === 'deals' ? [] : VIEWPORTS) {
    await p.setViewportSize({ width: v.w, height: v.h });
    await p.goto(base + '/dev/qa-layout/', { waitUntil: 'networkidle' });
    const res = [];
    for (const m of ['sent', 'select', 'terms', 'review']) res.push(await modal(p, `qa-layout-${m}`, new RegExp(`^${m}$`), v.w));
    report.pages.push({ label: `qa-layout-${v.w}`, url: '/dev/qa-layout/', extra: res });
  }
  await ctx.close();
} catch (e) {
  report.fatal = String(e.message).replace(/"[^"]*@[^"]*"/g, '"…"').slice(0, 300);
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, PHASE === 'deals' ? `report-stages${ONLY ? '-' + ONLY.join('-') : ''}.json` : 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('pages', report.pages.length, 'blocked', report.blocked.length, report.fatal || '');
}
