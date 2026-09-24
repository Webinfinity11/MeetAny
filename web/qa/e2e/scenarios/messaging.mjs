import { assert, rpc, db } from '../lib.mjs';
import { offerAndChat } from './company.mjs';
export default async function(t) {
  const company = await t.page('wood'), client = await t.page('hotel');
  const request = await t.fixture(client, 'მიმოწერა');
  await offerAndChat(t, company, client, request);
  await t.step('მოთხოვნის წაშლის შემდეგ ჩატის კონტრაქტი', 'წაშლა მუშაობს; შენახული საუბარი ზუსტად აღირიცხება SQL cleanup-ისთვის', async () => {
    await rpc(client, 'delete_request', { p_request_id: request.id });
    assert.equal((await db(client, `requests?select=id&id=eq.${request.id}`)).length, 0);
    const retained = (await rpc(client, 'list_my_conversations')).filter(c => c.context_key === request.id);
    return { requestDeleted: true, conversationsRetained: retained.length, requestIds: retained.map(c => c.request_id), cleanup: 'ცალკე SQL საჭიროა; წაშლის RPC არ არსებობს' };
  }, client);
}
