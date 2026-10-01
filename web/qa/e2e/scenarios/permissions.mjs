import { assert, api, db, rpc, go, requestRow, requestPath } from '../lib.mjs';
export default async function permissions(t) {
  const owner = await t.page('hotel'), company = await t.page('wood'), other = await t.page('cafe'), guest = await t.page();
  const request = await t.fixture(owner, 'უფლებები');
  const me = (await rpc(company, 'my_profile'))[0];
  const offer = await rpc(company, 'send_offer', { p_request_id: request.id, p_body: 'მიწოდება შესაძლებელია ხუთ სამუშაო დღეში. ' + t.marker });
  const conversation = await rpc(owner, 'start_conversation', { p_company_id: me.id, p_request_id: request.id });
  await t.step('უფლებები UI-ზე', 'სხვის მოთხოვნაზე რედაქტირება/გაგრძელება/არჩევა არ ჩანს', async () => {
    await go(other, requestPath(request.id));
    for (const label of [/^რედაქტირება$/, /^ვადის გაგრძელება/, /^შეთავაზების არჩევა$/]) assert.equal(await other.getByRole('button', { name: label }).count(), 0);
    assert((await db(other, `requests?select=id&id=eq.${request.id}`)).length === 1);
  }, other);
  for (const [name, page, fn, args, codes] of [
    ['სხვისი update', other, 'update_request', { p_request_id: request.id, p_title: request.title, p_body: request.body, p_category: request.category, p_city: request.city }, ['MA107']],
    ['სხვისი extend', other, 'extend_request', { p_request_id: request.id }, ['MA107']],
    ['სხვისი choose', other, 'choose_offer', { p_offer_id: offer.id }, ['MA206', 'MA107']],
    ['კომპანიის choose', company, 'choose_offer', { p_offer_id: offer.id }, ['MA107']],
    ['სხვისი საუბარი', other, 'list_messages', { p_conversation_id: conversation.id }, ['MA501']],
    ['არაადმინის RPC', other, 'admin_list_users', {}, ['MA003']],
    ['სტუმრის admin RPC', guest, 'admin_list_users', {}, []],
  ]) await t.step(name, '401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია', async () => {
    const r = await api(page, 'rpc/' + fn, args);
    const code = r.data?.hint || /^MA\d+/.exec(r.data?.message || '')?.[0];
    assert([401,403].includes(r.status) || (r.status === 400 && codes.includes(code)), `${fn}: HTTP ${r.status}, ${code || r.data?.code}`);
    return { status: r.status, code: code || r.data?.code };
  }, other);
  await t.step('მდგომარეობა შეტევების შემდეგ', 'GET requests/offers უცვლელია', async () => {
    assert.deepEqual(await requestRow(owner, request.id), request);
    assert.equal((await db(owner, `offers?select=*&id=eq.${offer.id}`))[0].status, 'sent');
  }, other);
}
