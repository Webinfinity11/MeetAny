import { assert, rpc, db, go, requestRow } from '../lib.mjs';
async function confirm(p, row, action) {
  await row.getByRole('button', { name: action, exact: true }).click();
  if (await p.locator('#moderation-reason').count()) await p.locator('#moderation-reason').fill('ავტომატური შემოწმების დროებითი მოქმედება');
  await p.locator('#moderation').getByRole('button', { name: 'დადასტურება', exact: true }).click();
  await p.locator('#moderation').waitFor({ state: 'hidden' });
}
export default async function(t) {
  const p = await t.page('owner_admin'), client = await t.page('hotel'), guest = await t.page();
  const request = await t.fixture(client, 'მოდერაცია');
  await t.step('მოთხოვნის დამალვა და დაბრუნება', 'საჯარო GET-ში ქრება და ჩნდება; UI სტატუსი იცვლება', async () => {
    await go(p, '/admin/?tab=requests&q=' + encodeURIComponent(request.id));
    const row = p.locator('tbody tr').filter({ hasText: request.title }); await row.waitFor();
    await confirm(p, row, 'დამალვა');
    assert.equal((await db(guest, `requests?select=id&id=eq.${request.id}`)).length, 0);
    assert((await requestRow(p, request.id)).hidden);
    await confirm(p, row, 'გამოჩენა');
    assert.equal((await db(guest, `requests?select=id&id=eq.${request.id}`)).length, 1);
    assert.equal((await requestRow(p, request.id)).hidden, false);
  }, p);
  await t.step('ადმინის კონტაქტების აღრიცხვა', 'ახალი contact_event-ის ID და მოქმედება UI ცხრილში ჩანს', async () => {
    const e = await rpc(guest, 'log_contact_event', { p_target_kind: 'request', p_target_id: request.id, p_kind: 'reveal', p_source: 'request-owner' });
    assert(e.recorded); t.contacts.add(e.id);
    const rows = await rpc(p, 'admin_contact_events'); assert(rows.items.some(r => r.id === e.id));
    await go(p, '/admin/?tab=contacts'); await p.locator(`[data-contact-event-id="${e.id}"]`).waitFor();
    assert((await p.locator(`[data-contact-event-id="${e.id}"]`).innerText()).includes('ნომრის ნახვა'));
  }, p);
}
