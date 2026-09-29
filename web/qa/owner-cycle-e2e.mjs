// Run: node qa/owner-cycle-e2e.mjs --company linen
// No account/profile mutations; only this run's marked request and exact contact-event IDs are removed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { assert, root, origin, guard, query, safe, markerFor, rpc, db, go, until, requestPath, requestRow } from './e2e/lib.mjs';

const state = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--company'), 'გამოყენება: --company <key>');
const companyKey = args[1] || (state.accounts.owner_company ? 'owner_company' : 'linen');
const run = `${Date.now()}-owner-cycle`, marker = markerFor(run);
const dir = path.join(root, 'qa/shots/owner-cycle', run);
fs.mkdirSync(dir, { recursive: true });
const report = { run, marker, companyKey, origin, steps: [], startedAt: new Date().toISOString() };
const previousReportPath = path.join(root, 'qa/owner-cycle-report.json');
if (fs.existsSync(previousReportPath)) {
  const previous = JSON.parse(fs.readFileSync(previousReportPath, 'utf8'));
  report.previousRun = { run: previous.run, pass: previous.pass, cleanup: previous.cleanup, steps: previous.steps };
}
const secrets = Object.values(state.accounts).map(a => a.password).filter(Boolean);
const clean = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), safe(value));
const save = () => fs.writeFileSync(path.join(root, 'qa/owner-cycle-report.json'), clean(JSON.stringify(report, null, 2)) + '\n');
const source = (file, needle) => {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  return `${file}:${Math.max(1, lines.findIndex(line => line.includes(needle)) + 1)}`;
};
const refs = {
  setup: source('app/components/market/AuthForms.tsx', 'login-password'),
  request: source('app/components/market/RequestFormSheet.tsx', 'new-request-form'),
  offer: source('app/components/market/RequestViewPageContent.tsx', 'of-body'),
  choose: source('app/components/market/RequestViewPageContent.tsx', 'confirmChoose'),
  chat: source('app/components/market/Inbox.tsx', 'inbox-body'),
  phone: source('app/components/market/CallButton.tsx', 'ნომრის ნახვა'),
  admin: source('app/components/market/AdminPageContent.tsx', 'admin-page'),
  cleanup: '../db/migrations/20260924-empty-conversations.sql:18',
};
let browser, client, company, guest, other, admin, companyProfile, clientProfile, request, offer, conversation;
let before, adminReady = false;
const contactIds = new Set();
const pendingEvents = new Set();
const ids = ['owner_user', 'owner_admin', companyKey, 'wood'].map(k => state.accounts[k]?.id);
async function snapshot() {
  return {
    profiles: await query('select * from public.profiles where id=any($1::uuid[]) order by id', [ids]),
    accounts: await query('select id,email,name,"emailVerified","createdAt" from neon_auth."user" where id=any($1::uuid[]) order by id', [ids]),
  };
}
async function shot(p, label) {
  assert(p && !p.isClosed(), 'კადრისთვის გვერდი მიუწვდომელია');
  // Clear passwords even after a failed login, before any capture.
  for (const input of await p.locator('input[type="password"]').all()) await input.fill('');
  await p.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; });
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  const file = path.join(dir, label + '.png');
  await p.screenshot({ path: file, fullPage: true, timeout: 10000 });
  return path.relative(root, file);
}
async function step(number, name, p, ref, fn) {
  const result = { number, name, status: 'PASS', screenshots: [] };
  const started = Date.now();
  try { result.note = await fn(result) || 'შემოწმებულია'; }
  catch (e) {
    result.status = 'FAIL'; result.reason = clean(e.message);
    result.source ||= ref; // Relevant app location, not an assertion of root cause.
    result.sourceMeaning = 'შესამოწმებელი აპის ადგილი; მიზეზის დადასტურება ანგარიშში';
  }
  const page = typeof p === 'function' ? p() : p;
  try { result.screenshots.push(await shot(page, `${number}-${result.status}`)); }
  catch (e) { result.status = 'FAIL'; result.screenshotError = clean(e.message); }
  result.ms = Date.now() - started;
  report.steps.push(result); save();
  console.log(clean(`${number}. ${name}: ${result.status}${result.reason ? ' — ' + result.reason : ''}`));
  return result.status === 'PASS';
}
async function page() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(25000);
  p.on('response', response => {
    if (!response.url().endsWith('/rpc/log_contact_event') || !response.ok()) return;
    const task = response.json().then(data => { if (data.recorded && data.id) contactIds.add(data.id); }).catch(() => {});
    pendingEvents.add(task); task.finally(() => pendingEvents.delete(task));
  });
  return p;
}
async function login(p, key) {
  const a = state.accounts[key];
  assert(a?.password && a?.id, `ledger-ში ანგარიში არ არის: ${key}`);
  await go(p, '/account/');
  await p.locator('#login-email').fill(a.email || `demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(a.password);
  await p.locator('main form button[type="submit"]').click();
  await p.locator('#login-email').waitFor({ state: 'hidden', timeout: 30000 });
  const me = (await rpc(p, 'my_profile'))[0];
  assert(me?.id === a.id && !me.blocked, 'შესვლის შემდეგ მოსალოდნელი აქტიური პროფილი ვერ მოიძებნა');
  return me;
}
try {
  guard(); assert.equal(origin, 'http://localhost:3001');
  const active = JSON.parse(execFileSync('agent', ['list'], { encoding: 'utf8' }));
  assert(!active.threads?.some(t => t.title === 'როლების e2e' && t.working), 'როლების e2e მუშაობს — გავლა არ დაწყებულა; გაიმეორეთ მისი დასრულების შემდეგ');
  assert(ids.every(Boolean), 'ledger-ში აუცილებელი ანგარიში არ არსებობს');
  assert(companyKey !== 'wood', '--company wood შეუთავსებელია დამოუკიდებელი wood როლის შემოწმებასთან');
  before = await snapshot();
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  client = await page(); company = await page(); guest = await page(); other = await page(); admin = await page();
  const ready = await step(0, 'შესვლა და წინაპირობები', client, refs.setup, async () => {
    clientProfile = await login(client, 'owner_user');
    companyProfile = await login(company, companyKey);
    await login(other, 'wood'); await login(admin, 'owner_admin'); adminReady = true;
    assert.equal(companyProfile.role, 'company');
    assert(companyProfile.industry, 'კომპანიის დარგი არ არის მითითებული');
    assert.equal((await query("select count(*)::int n from public.requests where owner_id=$1 and meetany_private.request_state(requests)='open'", [clientProfile.id]))[0].n, 0, 'კლიენტს უკვე აქვს ღია მოთხოვნა');
  });
  await step(1, 'მოთხოვნა ფორმით; კლიენტი და სტუმარი', client, refs.request, async r => {
    assert(ready, 'წინაპირობა ჩავარდა');
    await go(client, '/requests/new/');
    const title = `${marker} საოფისე მაგიდები 12 ცალი`;
    await client.locator('#title').fill(title);
    await client.locator('#category').selectOption(companyProfile.industry);
    await client.locator('#city').selectOption('tbilisi');
    await client.locator('#body').fill(`${marker} გვჭირდება 12 საოფისე მაგიდა, ადგილზე მიწოდებით.`);
    await client.locator('#quantity').fill('12');
    await client.locator('button[form="new-request-form"]').click();
    await client.locator('#new-request').waitFor({ state: 'hidden', timeout: 25000 });
    request = (await db(client, 'requests?select=*')).find(x => x.title === title);
    assert(request, 'ფორმიდან მოთხოვნა არ შეიქმნა'); report.requestId = request.id;
    await go(client, '/account/'); await client.locator(`.account-main a[href="${requestPath(request.id)}"]`).first().waitFor();
    await go(guest, '/requests/?q=' + encodeURIComponent(marker));
    await guest.locator(`main a[href="${requestPath(request.id)}"]`).first().waitFor();
    r.screenshots.push(await shot(guest, '1-guest'));
  });
  await step(2, 'წერილობითი შეთავაზება და იზოლაცია', company, refs.offer, async () => {
    assert(request, 'მოთხოვნა არ შექმნილა');
    await go(company, requestPath(request.id));
    const body = `${marker} მიწოდება შესაძლებელია ოთხ სამუშაო დღეში, ადგილზე მიტანით.`;
    await company.locator('#of-body').fill(body); await company.locator('#of-days').fill('4');
    await company.getByRole('button', { name: 'შეთავაზების გაგზავნა', exact: true }).click();
    await company.getByRole('button', { name: 'შეთავაზების რედაქტირება', exact: true }).waitFor();
    offer = (await db(company, `offers?select=*&request_id=eq.${request.id}`)).find(x => x.body === body);
    assert(offer && offer.delivery_days === 4, 'შეთავაზება/მიწოდების ვადა არ ემთხვევა');
    await go(company, '/account/');
    await company.locator('.account-section').filter({ has: company.getByRole('heading', { name: /^ჩემი შეთავაზებები/ }) }).locator(`a[href="${requestPath(request.id)}"]`).waitFor();
    assert.equal((await guest.request.get(origin + '/api/db/offers')).status(), 401, 'სტუმრის offers უნდა იყოს 401');
    assert.equal((await db(other, `offers?select=id&id=eq.${offer.id}`)).length, 0, 'სხვა კომპანია ხედავს შეთავაზებას');
  });
  await step(3, 'არჩევა და კონტაქტის უფლებები', client, refs.choose, async () => {
    assert(offer, 'შეთავაზება არ შექმნილა');
    await go(client, requestPath(request.id));
    await client.getByRole('heading', { name: /შეთავაზებები \(1\)/ }).waitFor();
    assert.equal((await db(client, `offers?select=id&request_id=eq.${request.id}`)).length, 1);
    await client.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
    await client.locator('#choose').getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
    await client.locator('#choose').waitFor({ state: 'hidden' });
    assert.equal((await requestRow(client, request.id)).chosen_offer_id, offer.id);
    assert.equal((await db(client, `offers?select=status&id=eq.${offer.id}`))[0].status, 'chosen');
    await client.getByText('მომწოდებელი არჩეულია', { exact: true }).first().waitFor();
    for (const [p, expected] of [[client, companyProfile], [company, clientProfile]]) {
      const contacts = await rpc(p, 'contact_for_request', { p_request_id: request.id });
      assert(contacts.length === 1 && contacts[0].email === expected.email && contacts[0].phone === expected.phone, 'მხარის კონტაქტი არ ემთხვევა');
    }
    assert.equal((await rpc(other, 'contact_for_request', { p_request_id: request.id })).length, 0);
  });
  await step(4, 'ჩატი: კლიენტი → კომპანია → კლიენტი', client, refs.chat, async r => {
    assert(request && companyProfile, 'მოთხოვნა/კომპანია მიუწვდომელია');
    const previous = Number(await rpc(company, 'unread_message_count'));
    conversation = await rpc(client, 'start_conversation', { p_company_id: companyProfile.id, p_request_id: request.id });
    const message = `${marker} გთხოვთ დაგვიდასტუროთ მიწოდების დრო.`, reply = `${marker} მიწოდება დადასტურებულია, ოთხ სამუშაო დღეში.`;
    await go(client, `/account/?tab=messages&c=${conversation.id}`);
    await client.locator('#inbox-body').fill(message);
    await client.getByRole('button', { name: 'გაგზავნა', exact: true }).click();
    await client.getByRole('log').getByText(message, { exact: true }).waitFor();
    await company.bringToFront();
    await go(company, '/account/');
    r.unread = { previous, rpc: Number(await rpc(company, 'unread_message_count')), visible: await company.evaluate(() => !document.hidden) };
    const unreadConversation = (await rpc(company, 'list_my_conversations')).find(c => c.id === conversation.id);
    r.unread.conversation = Number(unreadConversation?.unread_count || 0);
    let unreadFailure;
    try {
      assert(r.unread.conversation > 0, 'საუბარი RPC-ში წაუკითხავი არ არის');
      await until(async () => {
        const text = await company.locator('.ma-chat-badge').first().textContent({ timeout: 500 }).catch(() => '0');
        return parseInt(text || '0', 10) >= Math.min(99, previous + 1);
      }, 'კომპანიის წაუკითხავი ბეიჯი 25 წამში არ გაიზარდა', 25000);
      r.unread.ui = 'PASS';
    } catch (e) {
      unreadFailure = e; r.unread.ui = 'FAIL';
      r.source = source('app/lib/chat-client.ts', 'function useFeed');
    }
    r.screenshots.push(await shot(company, '4-unread'));
    await go(company, `/account/?tab=messages&c=${conversation.id}`);
    await company.getByRole('log').getByText(message, { exact: true }).waitFor();
    await company.locator('#inbox-body').fill(reply);
    await company.getByRole('button', { name: 'გაგზავნა', exact: true }).click();
    await company.getByRole('log').getByText(reply, { exact: true }).waitFor();
    await client.bringToFront();
    await client.getByRole('log').getByText(reply, { exact: true }).waitFor({ timeout: 20000 });
    r.replyVisible = true;
    if (unreadFailure) throw unreadFailure;
    return 'საუბრის დაწყება: RPC (request_id-ით); გაგზავნა, unread და პასუხი: UI';
  });
  await step(5, 'სტუმრის საჯარო ტელეფონი', guest, refs.phone, async () => {
    assert(companyProfile, 'კომპანიის შესვლა ჩავარდა');
    await go(guest, `/companies/view/?id=${companyProfile.id}`);
    await guest.getByRole('button', { name: 'ნომრის ნახვა', exact: true }).first().click();
    const call = guest.locator('a[data-contact-action="call"]').first(); await call.waitFor();
    assert(await call.getAttribute('href') === 'tel:' + companyProfile.phone.replace(/[^+\d]/g, ''), 'tel: არ ემთხვევა კომპანიის ნომერს');
  });
  await step(6, 'ადმინი: მოთხოვნა და ორივე მონაწილე', admin, refs.admin, async r => {
    assert(request && companyProfile, 'მოთხოვნა/კომპანია მიუწვდომელია');
    const rows = await rpc(admin, 'admin_search_requests', { p_q: marker });
    assert(rows.items.some(x => x.id === request.id), 'RPC: მოთხოვნა ვერ მოიძებნა');
    const users = await rpc(admin, 'admin_list_users');
    assert([clientProfile.id, companyProfile.id].every(id => users.some(u => u.id === id)), 'RPC: მონაწილე ვერ მოიძებნა');
    try {
      await go(admin, '/admin/?tab=requests&q=' + encodeURIComponent(marker));
      await admin.locator('tbody tr').filter({ hasText: marker }).waitFor({ timeout: 6000 });
      r.screenshots.push(await shot(admin, '6-request'));
      for (const [label, profile] of [['client', clientProfile], ['company', companyProfile]]) {
        await go(admin, '/admin/?tab=users&q=' + encodeURIComponent(profile.email));
        await admin.locator('tbody tr').filter({ hasText: profile.email }).waitFor({ timeout: 6000 });
        r.screenshots.push(await shot(admin, '6-' + label));
      }
      return 'UI: PASS, RPC: PASS';
    } catch (e) { r.uiReason = clean(e.message); return 'UI: ვერ შემოწმდა, RPC: PASS'; }
  });
  await step(8, 'მობილური 390×844: მოთხოვნა და ჩატი', company, refs.chat, async r => {
    assert(request && offer && conversation, 'მობილური კადრების წინაპირობა ჩავარდა');
    for (const [p, route, label] of [[client, requestPath(request.id), '8-request'], [company, `/account/?tab=messages&c=${conversation.id}`, '8-chat']]) {
      await p.setViewportSize({ width: 390, height: 844 }); await go(p, route);
      if (p === client) await p.locator('.ma-ocard__body').filter({ hasText: marker }).waitFor();
      else await p.getByRole('log').getByText(`${marker} მიწოდება დადასტურებულია, ოთხ სამუშაო დღეში.`, { exact: true }).waitFor();
      const overflow = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth));
      r.screenshots.push(await shot(p, label));
      assert.equal(overflow, 0, `${label}: ჰორიზონტალური გადაცდენა`);
    }
    return 'ორივე ეკრანი: ჰორიზონტალური გადაცდენა 0';
  });
} catch (e) {
  report.steps.push({ number: 0, name: 'გამშვები', status: 'FAIL', reason: clean(e.message) });
} finally {
  await step(7, 'გაწმენდა და უცვლელი პროფილები', () => admin || client, refs.cleanup, async r => {
    guard();
    // Recover the request even if creation succeeded but the UI timed out.
    const owned = await query('select id,owner_id from public.requests where position($1 in title)>0', [marker]);
    assert(owned.every(x => x.owner_id === state.accounts.owner_user.id), 'cleanup: მარკერი სხვა მფლობელს ეკუთვნის');
    const errors = [];
    if (owned.length && !admin) { assert(browser, 'cleanup: ბრაუზერი არ არსებობს'); admin = await page(); }
    if (owned.length && !adminReady) { await login(admin, 'owner_admin'); adminReady = true; }
    for (const row of owned) {
      try { await rpc(admin, 'admin_delete_request', { p_request_id: row.id }); }
      catch (e) { errors.push(clean(e.message)); }
    }
    await Promise.all([...pendingEvents]);
    if (contactIds.size) await query('delete from meetany_private.contact_events where id=any($1::uuid[])', [[...contactIds]]);
    const counts = (await query(`select
      (select count(*)::int from public.requests where position($1 in title)>0 or position($1 in body)>0) requests,
      (select count(*)::int from public.offers where position($1 in body)>0) offers,
      (select count(*)::int from meetany_private.messages where position($1 in body)>0) messages,
      (select count(*)::int from meetany_private.conversations where context_key=any($2::text[])) conversations,
      (select count(*)::int from public.requests where owner_id=$3 and meetany_private.request_state(requests)='open') ownerOpen`,
    [marker, [...new Set([...owned.map(x => x.id), ...(request ? [request.id] : [])])], state.accounts.owner_user.id]))[0];
    r.counts = counts; r.deletedContactEvents = contactIds.size; report.cleanup = counts;
    assert(Object.values(counts).every(n => n === 0), 'გაწმენდის შემდეგ ჩანაწერები დარჩა: ' + JSON.stringify(counts));
    assert(!errors.length, errors.join('; '));
    assert(before, 'საწყისი snapshot არ არსებობს');
    assert(JSON.stringify(await snapshot()) === JSON.stringify(before), 'ანგარიშის/პროფილის მონაცემები შეიცვალა');
    r.profilesUnchanged = true; r.accountsUnchanged = true;
    if (admin) { await admin.setViewportSize({ width: 1440, height: 1000 }); await go(admin, '/admin/?tab=requests&q=' + encodeURIComponent(marker)); }
  });
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  report.pass = report.steps.length === 9 && report.steps.every(s => s.status === 'PASS');
  save(); process.exitCode = report.pass ? 0 : 1;
}
