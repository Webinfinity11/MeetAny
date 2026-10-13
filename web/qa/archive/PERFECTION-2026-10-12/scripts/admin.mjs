// Stage 1 admin audit: screenshots + visible text of every /admin/ section at 1440 and 390, as owner_admin.
// STRICTLY READ-ONLY: every /api/db RPC outside READ_RPCS is aborted in the browser before it leaves,
// dialogs are opened and cancelled, nothing is submitted. Run from web/:
//   QA_ORIGIN=http://localhost:3300 node qa/PERFECTION-2026-10-12/scripts/admin.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3300';
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

const out = path.resolve(import.meta.dirname, '../before/admin');
fs.mkdirSync(out, { recursive: true });

// Reads only. Anything else (hide, block, verify, delete, edit, resolve, upload…) is aborted.
const READ_RPCS = new Set([
  'admin_overview', 'admin_stats', 'admin_search_users', 'admin_search_requests', 'admin_search_offers', 'admin_list_users',
  'admin_list_audit', 'admin_list_audit_v2', 'admin_list_reports', 'admin_business_queue', 'admin_business_audit',
  'admin_contact_events', 'admin_contact_stats', 'admin_message_stats', 'admin_market_metrics', 'admin_deal_issues',
  'admin_company_settings', 'site_content', 'verification_record', 'list_attachments', 'request_preferences',
  'my_profile', 'engagement_state', 'list_notifications', 'unread_message_count', 'list_my_conversations',
  'company_stats', 'offer_counts', 'list_companies', 'company_business_features', 'company_reviews', 'company_products',
  'company_distribution_profiles', 'my_business_settings', 'request_alert_preferences', 'list_saved_companies',
  'list_saved_requests', 'company_public_stats', 'list_my_deals', 'get_deal', 'my_request_draft', 'count_matching_suppliers',
  'list_matching_feed', 'compare_offers', 'list_matching', 'request_preferences',
]);
const blocked = [], rpcs = new Set(), errors = [];

const sections = ['overview', 'requests', 'companies', 'content', 'users', 'offers', 'reports', 'reviews', 'plans', 'photos', 'audit', 'contacts', 'demo'];
const report = { origin, at: new Date().toISOString(), screens: [] };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' });
  await context.route('**/*', route => {
    const req = route.request(); const url = new URL(req.url());
    const local = url.origin === origin;
    if (local && url.pathname.startsWith('/api/db/rpc/')) {
      const name = url.pathname.slice('/api/db/rpc/'.length);
      rpcs.add(name);
      if (!READ_RPCS.has(name)) { blocked.push(name); return route.abort('blockedbyclient'); }
    } else if (local && url.pathname.startsWith('/api/') && req.method() !== 'GET' && !url.pathname.startsWith('/api/db/')) {
      blocked.push(`${req.method()} ${url.pathname}`); return route.abort('blockedbyclient');
    } else if (url.href.startsWith(auth) && /sign-out|update|delete|change/.test(url.pathname)) {
      blocked.push(`auth ${url.pathname}`); return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(safe(e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(safe(m.text()).slice(0, 300)); });

  for (let n = 0; n < 6; n++) {
    const r = await page.request.post(auth + '/sign-in/email', { data: { email: account.email || 'demo-owner_admin@meetany.ge', password: secret } });
    if (r.ok()) break;
    if (r.status() !== 429) throw new Error(`sign-in HTTP ${r.status()}`);
    await new Promise(r => setTimeout(r, 20000));
  }

  const settle = async () => {
    await page.locator('main').first().waitFor({ timeout: 30000 });
    const t0 = Date.now();
    await page.waitForFunction(() => !!document.querySelector('main')?.innerText.trim() && !document.querySelector('main [aria-busy="true"]') && !/იტვირთება…/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 12000 })
      .catch(() => console.log(`  still loading after ${Date.now() - t0}ms: ${page.url().replace(origin, '')}`));
    await page.waitForTimeout(500);
  };
  const metrics = () => page.evaluate(() => {
    const main = document.querySelector('main');
    const wide = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; })
      .slice(0, 8).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} → ${Math.round(e.getBoundingClientRect().right)}`);
    const buttons = [...document.querySelectorAll('main button, main a.ma-btn, main [class*="btn"]')].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean);
    return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth, wide,
      text: (main?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 12000), buttons: [...new Set(buttons)].slice(0, 80) };
  });
  const shot = async (name, extra = {}) => {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    const m = await metrics();
    const dialog = await page.locator('dialog[open], [role="dialog"]:visible').first().innerText().catch(() => '');
    report.screens.push({ name, file, url: page.url().replace(origin, ''), ...m, dialog: dialog.slice(0, 3000), ...extra });
    console.log(`${name}${m.overflowX ? '  OVERFLOW ' + m.scrollWidth : ''}`);
  };
  const go = async q => { await page.goto(`${origin}/admin/${q}`, { waitUntil: 'domcontentloaded' }); await settle(); };
  const closeDialogs = async () => {
    for (let i = 0; i < 3; i++) {
      const cancel = page.locator('dialog[open]').getByRole('button', { name: /^(გაუქმება|დახურვა|რედაქტირების გაგრძელება)$/ }).last();
      if (await cancel.count()) { await cancel.click().catch(() => {}); await page.waitForTimeout(250); } else { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
    }
  };
  const tryStep = async (label, fn) => { try { await fn(); } catch (e) { report.screens.push({ name: label, skipped: safe(e.message).split('\n')[0] }); console.log(`skip ${label}: ${safe(e.message).split('\n')[0]}`); await closeDialogs(); } };

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const w = String(width);
    for (const s of sections) await tryStep(`${s}-${w}`, async () => { await go(s === 'overview' ? '' : `?tab=${s}`); await shot(`${s}-${w}`); });

    if (width === 390) await tryStep(`nav-open-${w}`, async () => {
      await go('?tab=requests'); await page.getByRole('button', { name: /ადმინის მენიუ/ }).click(); await page.waitForTimeout(300); await shot(`nav-open-${w}`);
      await page.keyboard.press('Escape');
    });

    // Empty filter result.
    await tryStep(`requests-empty-filter-${w}`, async () => { await go('?tab=requests&q=zzqqxx-nothing'); await shot(`requests-empty-filter-${w}`); });
    await tryStep(`requests-hidden-${w}`, async () => { await go('?tab=requests&status=hidden'); await shot(`requests-hidden-${w}`); });
    await tryStep(`companies-unverified-${w}`, async () => { await go('?tab=companies&status=unverified'); await shot(`companies-unverified-${w}`); });
    await tryStep(`offers-empty-filter-${w}`, async () => { await go('?tab=offers&q=zzqqxx-nothing'); await shot(`offers-empty-filter-${w}`); });
    await tryStep(`reports-handled-${w}`, async () => { await go('?tab=reports&status=handled'); await shot(`reports-handled-${w}`); });

    // Request: detail drawer → edit panel → hide dialog, each cancelled.
    await tryStep(`request-detail-${w}`, async () => {
      await go('?tab=requests');
      await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალები' }).click();
      await page.locator('dialog[open]').first().waitFor(); await page.waitForTimeout(800); await shot(`request-detail-${w}`);
      await page.locator('dialog[open]').getByRole('button', { name: 'რედაქტირება' }).click(); await page.waitForTimeout(500); await shot(`request-edit-${w}`);
      await page.locator('dialog[open]').getByRole('button', { name: 'გაუქმება' }).last().click(); await page.waitForTimeout(300);
      await page.locator('dialog[open]').getByRole('button', { name: /^(დამალვა|გამოჩენა)$/ }).click(); await page.waitForTimeout(400); await shot(`request-hide-confirm-${w}`);
      await closeDialogs();
      await page.locator('dialog[open]').getByRole('button', { name: 'წაშლა' }).click().catch(() => {}); await page.waitForTimeout(400);
      if (await page.locator('#moderation[open]').count()) await shot(`request-delete-confirm-${w}`);
      await closeDialogs();
    });
    await tryStep(`requests-bulk-${w}`, async () => {
      await go('?tab=requests');
      await page.locator('main table tbody tr').first().locator('input[type=checkbox]').check(); await page.waitForTimeout(300); await shot(`requests-bulk-${w}`);
      await page.locator('main table tbody tr').first().locator('input[type=checkbox]').uncheck();
    });

    // Company: detail (verification docs, plan) → edit → status menu → block dialog, each cancelled.
    await tryStep(`company-detail-${w}`, async () => {
      await go('?tab=companies');
      await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალები' }).click();
      await page.locator('dialog[open]').first().waitFor(); await page.waitForTimeout(1500);
      const plan = page.locator('dialog[open] details summary', { hasText: 'პაკეტი' }); if (await plan.count()) { await plan.click(); await page.waitForTimeout(600); }
      await shot(`company-detail-${w}`);
      await page.locator('dialog[open]').getByRole('button', { name: 'რედაქტირება' }).click(); await page.waitForTimeout(500); await shot(`company-edit-${w}`);
      await page.locator('dialog[open]').getByRole('button', { name: 'გაუქმება' }).last().click(); await page.waitForTimeout(300);
      await closeDialogs();
    });
    await tryStep(`company-status-menu-${w}`, async () => {
      await go('?tab=companies');
      await page.locator('main table tbody tr').first().getByRole('button', { name: /სტატუსის მართვა/ }).click(); await page.waitForTimeout(300); await shot(`company-status-menu-${w}`);
      await page.getByRole('menuitem', { name: /დაბლოკვა|განბლოკვა/ }).first().click(); await page.waitForTimeout(400); await shot(`company-block-confirm-${w}`);
      await closeDialogs();
    });
    // Pending company in the overview queue (verification flow).
    await tryStep(`pending-company-detail-${w}`, async () => {
      await go('?tab=companies&status=unverified');
      const row = page.locator('main table tbody tr').first(); if (!await row.count()) throw new Error('no unverified company');
      await row.getByRole('button', { name: 'დეტალები' }).click(); await page.locator('dialog[open]').first().waitFor(); await page.waitForTimeout(1500);
      await shot(`pending-company-detail-${w}`);
      await page.locator('dialog[open]').getByRole('button', { name: 'დადასტურება' }).last().click(); await page.waitForTimeout(400); await shot(`company-verify-confirm-${w}`);
      await closeDialogs();
    });
    await tryStep(`user-detail-${w}`, async () => {
      await go('?tab=users&role=client');
      await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალები' }).click();
      await page.locator('dialog[open]').first().waitFor(); await page.waitForTimeout(1000); await shot(`user-detail-${w}`);
      await closeDialogs();
    });
    await tryStep(`offer-delete-confirm-${w}`, async () => {
      await go('?tab=offers');
      await page.locator('main table tbody tr').getByRole('button', { name: 'წაშლა' }).and(page.locator(':enabled')).first().click(); await page.waitForTimeout(400);
      await shot(`offer-delete-confirm-${w}`); await closeDialogs();
    });
    await tryStep(`reports-deal-issue-${w}`, async () => {
      await go('?tab=reports');
      const issue = page.locator('main details summary').first(); if (await issue.count()) { await issue.click(); await page.waitForTimeout(800); }
      await shot(`reports-deal-issue-${w}`);
      const hide = page.locator('main table tbody tr').first().getByRole('button').first();
      if (await hide.count() && await hide.isEnabled()) { await hide.click(); await page.waitForTimeout(400); await shot(`report-action-confirm-${w}`); await closeDialogs(); }
    });
    await tryStep(`photo-remove-confirm-${w}`, async () => {
      await go('?tab=photos');
      await page.locator('main').getByRole('button', { name: 'წაშლა' }).first().click(); await page.waitForTimeout(400);
      await shot(`photo-remove-confirm-${w}`); await closeDialogs();
    });
    await tryStep(`audit-business-${w}`, async () => {
      await go('?tab=audit'); await page.locator('main details summary', { hasText: 'პაკეტები და შიგთავსი' }).click(); await page.waitForTimeout(1200); await shot(`audit-business-${w}`);
    });
    await tryStep(`content-preview-${w}`, async () => {
      await go('?tab=content'); await page.getByRole('button', { name: 'წინასწარი ნახვა' }).click(); await page.waitForTimeout(400); await shot(`content-preview-${w}`);
    });
  }
} catch (e) {
  console.error(safe(e.stack)); process.exitCode = 1;
} finally {
  report.rpcsCalled = [...rpcs].sort();
  report.blockedWrites = [...new Set(blocked)];
  report.errors = [...new Set(errors)].slice(0, 60);
  fs.writeFileSync(path.join(out, 'report.json'), safe(JSON.stringify(report, null, 1)));
  console.log(`blocked writes: ${report.blockedWrites.join(', ') || 'none'}`);
  await browser.close();
}
