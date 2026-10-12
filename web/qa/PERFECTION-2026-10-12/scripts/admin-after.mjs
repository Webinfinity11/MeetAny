// Stage 3 admin: after screenshots of every admin section and the new detail screens, at 1440 and 390, as owner_admin.
// READ-ONLY like admin.mjs: every /api/db RPC outside READ_RPCS is aborted in the browser; dialogs are opened and closed.
// Run from web/:  QA_ORIGIN=http://localhost:3308 node qa/PERFECTION-2026-10-12/scripts/admin-after.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3308';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('only a local QA_ORIGIN');
const site = process.env.QA_SITE || '/Users/kapana/Desktop/infinty/MeetAny/site';
const env = Object.fromEntries(fs.readFileSync(path.join(site, 'web/.env.local'), 'utf8').split(/\r?\n/).flatMap(line => {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const auth = env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
const ledger = JSON.parse(fs.readFileSync(path.join(site, 'DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const account = ledger.accounts.owner_admin;
const secret = account.password;
const safe = v => String(v).replaceAll(secret, '[redacted]');
const out = path.resolve(import.meta.dirname, '../after/admin');
fs.mkdirSync(out, { recursive: true });

const READ_RPCS = new Set([
  'admin_overview', 'admin_stats', 'admin_search_users', 'admin_search_requests', 'admin_search_offers', 'admin_list_users',
  'admin_list_audit', 'admin_list_audit_v2', 'admin_list_reports', 'admin_business_queue', 'admin_business_audit',
  'admin_contact_events', 'admin_contact_stats', 'admin_message_stats', 'admin_market_metrics', 'admin_deal_issues',
  'admin_company_settings', 'site_content', 'verification_record', 'list_attachments', 'list_attachments_many', 'request_preferences',
  'my_profile', 'engagement_state', 'list_notifications', 'unread_message_count', 'list_my_conversations',
  'company_stats', 'offer_counts', 'list_companies', 'company_business_features', 'company_reviews', 'company_products',
  'company_distribution_profiles', 'my_business_settings', 'request_alert_preferences', 'list_saved_companies',
  'list_saved_requests', 'company_public_stats', 'list_my_deals', 'get_deal', 'my_request_draft', 'count_matching_suppliers',
  'list_matching_feed', 'compare_offers', 'list_matching', 'admin_list_deals', 'admin_list_reviews',
]);
const sections = ['overview', 'requests', 'companies', 'deals', 'offers', 'users', 'reports', 'reviews', 'content', 'contacts', 'photos', 'audit'];
const blocked = [], errors = [], report = { origin, at: new Date().toISOString(), screens: [] };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' });
  await context.route('**/*', route => {
    const req = route.request(); const url = new URL(req.url());
    const local = url.origin === origin;
    if (local && url.pathname.startsWith('/api/db/rpc/')) {
      const name = url.pathname.slice('/api/db/rpc/'.length);
      if (!READ_RPCS.has(name)) { blocked.push(name); return route.abort('blockedbyclient'); }
    } else if (local && url.pathname.startsWith('/api/') && req.method() !== 'GET' && !url.pathname.startsWith('/api/db/')) {
      blocked.push(`${req.method()} ${url.pathname}`); return route.abort('blockedbyclient');
    } else if (url.href.startsWith(auth) && /sign-out|update|delete|change/.test(url.pathname)) {
      blocked.push(`auth ${url.pathname}`); return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${page.url().replace(origin, '')}: ${safe(e.message)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url().replace(origin, '')}: ${safe(m.text()).slice(0, 300)}`); });
  for (let n = 0; n < 6; n++) {
    const r = await page.request.post(auth + '/sign-in/email', { data: { email: account.email || 'demo-owner_admin@meetany.ge', password: secret } });
    if (r.ok()) break;
    if (r.status() !== 429) throw new Error(`sign-in HTTP ${r.status()}`);
    await new Promise(r => setTimeout(r, 20000));
  }
  const settle = async () => {
    await page.locator('main').first().waitFor({ timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('main')?.innerText.trim() && !/იტვირთება…/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
  };
  const shot = async name => {
    await page.waitForFunction(() => !/იტვირთება…/.test(document.querySelector('dialog[open]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    const m = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > innerWidth + 1, text: (document.querySelector('dialog[open]') || document.querySelector('main'))?.innerText.slice(0, 4000) }));
    report.screens.push({ name, url: page.url().replace(origin, ''), ...m });
    console.log(`${name}${m.overflowX ? '  OVERFLOW' : ''}`);
  };
  const go = async q => { await page.goto(`${origin}/admin/${q}`, { waitUntil: 'domcontentloaded' }); await settle(); };
  const dialog = () => page.locator('dialog[open]').last();
  const closeAll = async () => { for (let i = 0; i < 3; i++) { if (!await page.locator('dialog[open]').count()) break; await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
  const tryStep = async (label, fn) => { try { await fn(); } catch (e) { report.screens.push({ name: label, skipped: safe(e.message).split('\n')[0] }); console.log(`skip ${label}: ${safe(e.message).split('\n')[0]}`); await closeAll(); } };
  const openRow = async (q, button = 'დეტალების ნახვა') => { await go(q); await page.locator('main table tbody tr').first().getByRole('button', { name: button }).click(); await dialog().waitFor(); await page.waitForTimeout(900); };

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const w = String(width);
    for (const s of sections) await tryStep(`${s}-admin-${w}`, async () => { await go(s === 'overview' ? '' : `?tab=${s}`); await shot(`${s}-admin-${w}`); });
    await tryStep(`plans-hidden-admin-${w}`, async () => { await go('?tab=plans'); await shot(`plans-hidden-admin-${w}`); });
    if (width === 390) await tryStep(`nav-open-admin-${w}`, async () => { await go('?tab=requests'); await page.getByRole('button', { name: /ადმინის განყოფილება/ }).click(); await page.waitForTimeout(300); await shot(`nav-open-admin-${w}`); await page.keyboard.press('Escape'); });
    await tryStep(`companies-pending-admin-${w}`, async () => { await go('?tab=companies&status=pending'); await shot(`companies-pending-admin-${w}`); });
    await tryStep(`company-detail-admin-${w}`, async () => { await openRow('?tab=companies&status=verified'); await shot(`company-detail-admin-${w}`); await closeAll(); });
    await tryStep(`company-unverify-admin-${w}`, async () => {
      await openRow('?tab=companies&status=verified');
      await dialog().getByRole('button', { name: /ვერიფიკაციის მოხსნა/ }).click(); await page.locator('#moderation[open]').waitFor(); await page.waitForTimeout(300);
      await shot(`company-unverify-admin-${w}`); await closeAll();
    });
    await tryStep(`company-edit-admin-${w}`, async () => { await openRow('?tab=companies&status=verified'); await dialog().getByRole('button', { name: 'რედაქტირება' }).click(); await page.waitForTimeout(500); await shot(`company-edit-admin-${w}`); await closeAll(); });
    await tryStep(`request-detail-admin-${w}`, async () => { await openRow('?tab=requests'); await shot(`request-detail-admin-${w}`); await closeAll(); });
    await tryStep(`request-chosen-detail-admin-${w}`, async () => { await openRow('?tab=requests&status=chosen'); await shot(`request-chosen-detail-admin-${w}`); await closeAll(); });
    await tryStep(`deal-detail-admin-${w}`, async () => { await openRow('?tab=deals'); await shot(`deal-detail-admin-${w}`); await closeAll(); });
    await tryStep(`deal-stage-admin-${w}`, async () => {
      await closeAll(); await openRow('?tab=deals&status=discuss');
      await dialog().getByRole('button', { name: /ეტაპის შეცვლა/ }).click(); await page.locator('#moderation[open]').waitFor(); await page.waitForTimeout(300);
      await shot(`deal-stage-admin-${w}`); await closeAll();
    });
    await tryStep(`offer-detail-admin-${w}`, async () => { await go('?tab=offers'); await page.locator('main table tbody tr').first().locator('td').first().getByRole('button').click(); await dialog().waitFor(); await page.waitForTimeout(900); await shot(`offer-detail-admin-${w}`); await closeAll(); });
    await tryStep(`review-hide-admin-${w}`, async () => { await go('?tab=reviews'); await page.locator('main table tbody tr').first().getByRole('button', { name: /დამალვა|აღდგენა/ }).click(); await page.locator('#moderation[open]').waitFor(); await page.waitForTimeout(300); await shot(`review-hide-admin-${w}`); await closeAll(); });
  }
} finally {
  await browser.close();
  report.blocked = [...new Set(blocked)]; report.errors = errors;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log('blocked writes:', report.blocked.join(', ') || 'none');
  console.log('console errors:', errors.length); for (const e of errors.slice(0, 20)) console.log('  ', e);
}
