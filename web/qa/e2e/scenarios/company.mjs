import { assert, db, rpc, go, until, requestPath, profileArgs } from '../lib.mjs';
export async function offerAndChat(t, p, client, request, chat = true) {
  let offer, conversation;
  await t.step('კომპანია: შეთავაზების გაგზავნა', 'UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას', async () => {
    await go(p, requestPath(request.id));
    const body = 'მაგიდას მოგაწვდით ადგილზე აწყობით. ' + t.marker;
    await p.locator('#of-body').fill(body); await p.locator('#of-days').fill('4');
    await p.getByRole('button', { name: 'შეთავაზების გაგზავნა', exact: true }).click();
    await p.getByRole('button', { name: 'შეთავაზების რედაქტირება', exact: true }).waitFor();
    const rows = await db(p, `offers?select=*&request_id=eq.${request.id}`);
    offer = rows.find(r => r.body === body); assert(offer); assert.equal(offer.delivery_days, 4);
  }, p);
  if (!chat) return offer;
  await t.step('ჩატი მოთხოვნიდან და წაუკითხავი ბეიჯი', 'შეტყობინება RPC-შია და მიმღების ჰედერში წაუკითხავი იზრდება', async () => {
    const previous = Number(await rpc(client, 'unread_message_count'));
    await p.getByRole('button', { name: 'მიწერა', exact: true }).first().click();
    const body = 'მიწოდების დრო შეგვიძლია ხვალ შევათანხმოთ. ' + t.marker;
    await p.locator('#ma-chat-body').fill(body);
    await p.locator('.ma-chat').getByRole('button', { name: 'გაგზავნა', exact: true }).click();
    await p.locator('.ma-chat__message p', { hasText: body }).waitFor();
    conversation = (await rpc(p, 'list_my_conversations')).find(c => c.request_id === request.id);
    assert(conversation);
    const messages = await rpc(client, 'list_messages', { p_conversation_id: conversation.id });
    assert(messages.some(m => m.body === body));
    await go(client, '/account/');
    await until(async () => Number(await client.locator('.ma-chat-badge').first().innerText()) >= previous + 1, 'ჰედერის unread ბეიჯი არ განახლდა');
    await p.getByRole('button', { name: 'მიმოწერის დახურვა' }).click();
  }, p);
  await t.step('კლიენტის პასუხი და კომპანიის ინბოქსი', '?tab=messages&c=id აჩვენებს საუბარს; პასუხი ბაზაშია; კომპანიის unread იზრდება', async () => {
    assert(conversation, 'წინა ნაბიჯში საუბარი არ შექმნილა');
    await go(client, `/account/?tab=messages&c=${conversation.id}`);
    const reply = 'დიახ, ხვალ დილით შეგვიძლია მიღება. ' + t.marker;
    await client.locator('#inbox-body').fill(reply);
    await client.getByRole('button', { name: 'გაგზავნა', exact: true }).click();
    await until(async () => (await rpc(p, 'list_messages', { p_conversation_id: conversation.id })).some(m => m.body === reply), 'კლიენტის პასუხი ბაზაში არ არის');
    await go(p, '/account/'); await p.locator('.ma-chat-badge').first().waitFor();
    await go(p, `/account/?tab=messages&c=${conversation.id}`);
    await p.locator('#inbox-body').waitFor();
    await p.getByRole('log').getByText(reply, { exact: true }).waitFor();
    assert.equal(new URL(p.url()).searchParams.get('tab'), 'messages');
  }, p);
  return offer;
}
export default async function(t) {
  const p = await t.page('wood');
  const original = (await rpc(p, 'my_profile'))[0];
  const originalArgs = await profileArgs(original);
  t.restoreAfter({ id: original.id, email: original.email, fields: Object.fromEntries(['address','lat','lng','offers'].map(k => [k, original[k]])) });
  await t.step('პროფილის მისამართი და პროდუქტები', 'შეცვლილი მნიშვნელობები UI-სა და GET profiles-ში რჩება', async () => {
    await go(p, '/account/?tab=profile');
    await p.locator('#address').fill('წერეთლის გამზირი 100');
    await p.locator('#offers').fill('მაგიდის დამზადება\nადგილზე მიტანა');
    await p.getByRole('button', { name: 'შენახვა', exact: true }).click();
    await p.getByText('ცვლილებები შენახულია.', { exact: true }).waitFor();
    const row = (await db(p, `profiles?select=id,address,offers&id=eq.${original.id}`))[0];
    assert.equal(row.address, 'წერეთლის გამზირი 100'); assert.deepEqual(row.offers, ['მაგიდის დამზადება','ადგილზე მიტანა']);
    assert.equal(await p.locator('#address').inputValue(), row.address);
  }, p);
  await t.step('კოორდინატების რედაქტირების UI', 'პროფილის ფორმაში განედი და გრძედი რედაქტირებადია', async () => {
    await p.getByLabel('განედი', { exact: true }).fill('41.72');
    await p.getByLabel('გრძედი', { exact: true }).fill('44.79');
    await p.getByRole('button', { name: 'შენახვა', exact: true }).click();
    await until(async () => {
      const row = (await db(p, `profiles?select=id,lat,lng&id=eq.${original.id}`))[0];
      return row.lat === 41.72 && row.lng === 44.79;
    }, 'UI-დან კოორდინატები არ შენახულა');
  }, p);
  await t.step('კოორდინატების API და პროფილის დაბრუნება', 'API კოორდინატებს ინახავს; თავდაპირველი მონაცემები სრულად აღდგება', async () => {
    await rpc(p, 'update_my_profile', { ...originalArgs, p_lat: 41.72, p_lng: 44.79 });
    const row = (await db(p, `profiles?select=id,lat,lng&id=eq.${original.id}`))[0]; assert.equal(row.lat, 41.72); assert.equal(row.lng, 44.79);
    await rpc(p, 'update_my_profile', originalArgs);
    const restored = (await rpc(p, 'my_profile'))[0];
    for (const field of ['address','lat','lng','offers']) assert.deepEqual(restored[field], original[field]);
  }, p);

}
