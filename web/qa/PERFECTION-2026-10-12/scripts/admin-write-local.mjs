// Stage 3 admin: write actions through the UI, ONLY against the local database and ONLY on test records
// ([ux-audit] deal/request, an e2e registration company). Checks each result in Postgres, then restores what it can.
// Run from web/:  QA_ORIGIN=http://localhost:3308 node qa/PERFECTION-2026-10-12/scripts/admin-write-local.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3308';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('only a local QA_ORIGIN');
const site = process.env.QA_SITE || '/Users/kapana/Desktop/infinty/MeetAny/site';
const env = Object.fromEntries(fs.readFileSync(path.join(site, 'web/.env.local'), 'utf8').split(/\r?\n/).flatMap(line => {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const dsn = env.MEETANY_LOCAL_DATABASE_URL;
if (!dsn || !['localhost', '127.0.0.1'].includes(new URL(dsn).hostname)) throw new Error('must use the local database');
const sql = q => execFileSync('psql', ['-X', '-At', dsn, '-c', q], { encoding: 'utf8' }).trim();
const auth = env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
const ledger = JSON.parse(fs.readFileSync(path.join(site, 'DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const account = ledger.accounts.owner_admin;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

const deal = sql("select d.id from meetany_private.deals d join public.requests r on r.id=d.request_id where r.title like '[ux-audit]%' and d.stage='discuss' limit 1");
const request = sql("select id from public.requests where title like '[ux-audit]%' limit 1");
const company = sql("select id from public.profiles where role='company' and company like '%[e2e%' and not verified and verification_documents_status='not_submitted' order by created_at limit 1");
const original = company && sql(`select blocked||'|'||coalesce(blocked_reason,'') from public.profiles where id='${company}'`);
// The e2e company may be blocked by an earlier run: unblock it for the test, restore at the end.
if (company) sql(`update public.profiles set blocked=false,blocked_reason=null where id='${company}'`);
if (!deal || !request || !company) throw new Error('test records missing');

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' })).newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const r = await page.request.post(auth + '/sign-in/email', { data: { email: account.email || 'demo-owner_admin@meetany.ge', password: account.password } });
  if (!r.ok()) throw new Error(`sign-in HTTP ${r.status()}`);
  const moderation = page.locator('#moderation[open]');
  const confirm = async (reason, choice) => {
    await moderation.waitFor();
    if (choice) await moderation.locator('#moderation-choice').selectOption(choice);
    if (reason) await moderation.locator('#moderation-reason').fill(reason);
    await moderation.locator('button[type=submit]').click();
    await moderation.waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForTimeout(800);
  };

  if (process.env.ONLY_COMPANY) { results.length = 0; } else {
  // 1. Deal: forced stage discuss -> terms, then back to discuss (audited both times).
  await page.goto(`${origin}/admin/?tab=deals&q=${deal}`); await page.locator('main table tbody tr').first().waitFor();
  await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალების ნახვა' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /ეტაპის შეცვლა/ }).click();
  await confirm('QA: ეტაპის იძულებითი შეცვლის შემოწმება', 'terms');
  check('deal stage forced to terms', sql(`select stage from meetany_private.deals where id='${deal}'`) === 'terms');
  await page.locator('dialog[open]').getByRole('button', { name: /ეტაპის შეცვლა/ }).click();
  await confirm('QA: ეტაპის აღდგენა', 'discuss');
  check('deal stage restored to discuss', sql(`select stage from meetany_private.deals where id='${deal}'`) === 'discuss');
  check('both stage changes audited', Number(sql(`select count(*) from meetany_private.moderation_audit where target_id='${deal}' and action='deal.stage' and reason like 'QA:%'`)) >= 2);
  await page.keyboard.press('Escape');

  // 2. Request budget: exact 500 ₾, then back to the original preferences.
  const before = sql(`select coalesce(preferences::text,'{}') from meetany_private.request_preferences where request_id='${request}'`) || '{}';
  await page.goto(`${origin}/admin/?tab=requests&q=${request}`); await page.locator('main table tbody tr').first().waitFor();
  await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალების ნახვა' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'შეცვლა' }).click();
  await page.locator('dialog[open] select').first().selectOption('exact');
  await page.locator('dialog[open]').getByLabel('თანხა, ₾').fill('500');
  await page.locator('dialog[open]').getByRole('button', { name: 'პირობების შენახვა' }).click();
  await page.waitForTimeout(1500);
  check('request budget saved', sql(`select budget_type||':'||budget_min from public.requests where id='${request}'`) === 'exact:500.00' || sql(`select budget_type||':'||budget_min::int from public.requests where id='${request}'`) === 'exact:500');
  check('budget change audited', Number(sql(`select count(*) from meetany_private.moderation_audit where target_id='${request}' and action='request.preferences'`)) >= 1);
  sql(`select set_config('request.jwt.claims','',false); insert into meetany_private.request_preferences(request_id,preferences) values('${request}','${before.replace(/'/g, "''")}'::jsonb) on conflict(request_id) do update set preferences=excluded.preferences; update public.requests set budget_type=null,budget_min=null,budget_max=null where id='${request}' and '${before.replace(/'/g, "''")}'::jsonb->>'budgetType' is null`);
  await page.keyboard.press('Escape');

  }
  // 3. Company: verify, then remove verification with a reason -> documents returned, note kept, company notified.
  await page.goto(`${origin}/admin/?tab=companies&q=${company}`); await page.locator('main table tbody tr').first().waitFor();
  await page.locator('main table tbody tr').first().getByRole('button', { name: 'დეტალების ნახვა' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /^ვერიფიცირება…$/ }).click();
  await confirm('', null);
  check('company verified, documents approved', sql(`select verified||':'||verification_documents_status from public.profiles where id='${company}'`) === 'true:approved');
  await page.locator('dialog[open]').getByRole('button', { name: /ვერიფიკაციის მოხსნა/ }).click();
  await confirm('QA: სატესტო კომპანიის ვერიფიკაციის მოხსნა', null);
  check('company unverified with reason', sql(`select verified||':'||verification_documents_status||':'||verification_note from public.profiles where id='${company}'`) === 'false:rejected:QA: სატესტო კომპანიის ვერიფიკაციის მოხსნა');
  check('company notified twice', Number(sql(`select count(*) from meetany_private.notifications where user_id='${company}' and kind='verification_reviewed'`)) >= 2);
  // Back to the original state of the test record (no documents ever sent).
  sql(`update public.profiles set verification_documents_status='not_submitted',verification_note=null where id='${company}'`);
  const [wasBlocked, reason] = original.split('|');
  sql(`update public.profiles set blocked=${wasBlocked === 'true'},blocked_reason=${reason ? `'${reason.replace(/'/g, "''")}'` : 'null'} where id='${company}'`);
} finally {
  await browser.close();
  console.log('console errors:', errors.length, errors.slice(0, 5));
  console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
  if (results.some(r => !r.ok)) process.exitCode = 1;
}
