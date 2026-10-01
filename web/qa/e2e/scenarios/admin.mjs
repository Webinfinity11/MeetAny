import { assert, rpc, db, go, until, requestRow, query } from '../lib.mjs';
async function confirm(p, row, action) {
  await row.getByRole('button', { name: action, exact: true }).click();
  if (await p.locator('#moderation-reason').count()) await p.locator('#moderation-reason').fill('ავტომატური შემოწმების დროებითი მოქმედება');
  await p.locator('#moderation').getByRole('button', { name: 'დადასტურება', exact: true }).click();
  await p.locator('#moderation').waitFor({ state: 'hidden' });
}
export default async function(t) {
  const p = await t.page('owner_admin'), guest = await t.page();
  const users = await rpc(p, 'admin_list_users');
  // Use an unverified company so verified_at is restored exactly to NULL.
  const company = users.find(u => u.role === 'company' && !u.verified && !u.blocked && u.email.startsWith('demo-'));
  assert(company, 'არავერიფიცირებული დემო კომპანია ვერ მოიძებნა');
  t.restoreAfter({ id: company.id, email: company.email, fields: { blocked: company.blocked, blocked_reason: company.blocked_reason, verified: company.verified, verified_at: company.verified_at } });
  await t.step('მომხმარებლების სია და T4.4 რაოდენობა', 'UI-ისა და admin_stats-ის მთვლელები ემთხვევა SQL-ისა და სიის არაადმინების რაოდენობას', async () => {
    await go(p, '/admin/?tab=users'); await p.locator('tbody tr').first().waitFor();
    const stats = await rpc(p, 'admin_stats');
    const actual = (await query('select count(*)::int total, count(*) filter(where role<>\'admin\')::int nonadmin, count(*) filter(where not blocked and role<>\'admin\')::int active from public.profiles'))[0];
    // The user count moved to the overview's KPI row („მომხმარებელი“, linking to the users tab).
    await go(p, '/admin/');
    const kpi = p.locator('a[href="/admin/?tab=users"]').filter({ hasText: 'მომხმარებელი' }).locator('strong');
    await until(async () => /^\d+$/.test((await kpi.innerText()).trim()), 'მომხმარებლების მთვლელი არ ჩაიტვირთა');
    const ui = Number((await kpi.innerText()).trim());
    const evidence = { ui, api: stats.users, list: users.length, total: actual.total, nonadmin: actual.nonadmin, active: actual.active };
    t.counts = evidence;
    assert.equal(users.filter(user => user.role !== 'admin').length, actual.nonadmin);
    assert.equal(Number(stats.users), actual.nonadmin, 'T4.4 API: ' + JSON.stringify(evidence));
    assert.equal(ui, actual.nonadmin, 'T4.4 UI: ' + JSON.stringify(evidence));
    return evidence;
  }, p);
  await t.step('ვერიფიკაცია/ბლოკი და დაბრუნება', 'UI ქმედებები იცვლება; RPC და საჯარო GET სტატუსს ადასტურებს', async () => {
    await go(p, '/admin/?tab=users&q=' + encodeURIComponent(company.email));
    const row = p.locator('tbody tr').filter({ hasText: company.email }); await row.waitFor();
    await confirm(p, row, 'დადასტურება');
    assert((await rpc(p, 'admin_list_users')).find(u => u.id === company.id).verified);
    await confirm(p, row, 'დადასტურების მოხსნა');
    assert.equal((await rpc(p, 'admin_list_users')).find(u => u.id === company.id).verified, false);
    await confirm(p, row, 'დაბლოკვა');
    assert((await rpc(p, 'admin_list_users')).find(u => u.id === company.id).blocked);
    assert.equal((await db(guest, `profiles?select=id&id=eq.${company.id}`)).length, 0, 'დაბლოკილი პროფილი სტუმრის GET profiles-ში კვლავ ჩანს');
    await confirm(p, row, 'განბლოკვა');
    assert.equal((await rpc(p, 'admin_list_users')).find(u => u.id === company.id).blocked, false);
    assert.equal((await db(guest, `profiles?select=id&id=eq.${company.id}`)).length, 1);
  }, p);
}
