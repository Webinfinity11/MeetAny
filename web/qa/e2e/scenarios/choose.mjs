import { assert, db, go, requestRow, requestPath } from '../lib.mjs';
import { offerAndChat } from './company.mjs';
export default async function choose(t) {
  const client = await t.page('hotel'), company = await t.page('wood');
  const request = await t.fixture(client, 'არჩევა');
  const offer = await offerAndChat(t, company, client, request, false);
  await t.step('შეთავაზების არჩევა კომპანიის ნაბიჯების შემდეგ', 'chosen_offer_id და offers.status შეესაბამება არჩეულ შეთავაზებას', async () => {
    assert(offer, 'კომპანიის შეთავაზება არ შექმნილა');
    await go(client, requestPath(request.id));
    await client.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
    await client.locator('#choose').getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
    await client.locator('#choose').waitFor({ state: 'hidden' });
    assert.equal((await requestRow(client, request.id)).chosen_offer_id, offer.id);
    assert.equal((await db(client, `offers?select=*&id=eq.${offer.id}`))[0].status, 'chosen');
  }, client);
}
