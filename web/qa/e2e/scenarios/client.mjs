import path from 'node:path';
import { assert, root, db, go, until, requestRow, requestPath, choose } from '../lib.mjs';
export default async function(t) {
  const p = await t.page('hotel');
  let request;
  await t.step('მოთხოვნის შექმნა ფოტოთი', 'ახალი მოთხოვნა და ატვირთული ფოტო GET requests-შია და UI-ზე ჩანს', async () => {
    await go(p, '/requests/new/');
    const title = 'ხის მაგიდის მიწოდება ' + t.marker;
    await p.locator('#title').fill(title); await choose(p, '#category', 'furniture');
    await choose(p, '#city', 'tbilisi');
    await p.locator('#body').fill('გვჭირდება ხის მაგიდა, ადგილზე მიტანით და აწყობით.');
    await p.locator('#quantity').fill('2');
    await p.locator('input[type="file"]').setInputFiles(path.join(root, 'public/assets/photos/workshop-banner.jpg'));
    await p.locator('button[form="new-request-form"]').click();
    await p.locator('#new-request').waitFor({ state: 'hidden', timeout: 18000 });
    request = (await db(p, 'requests?select=*')).find(r => r.title === title);
    assert(request?.photo_url); t.requests.add(request.id); t.photos.add(request.photo_url);
    await go(p, requestPath(request.id));
    await p.locator('main').getByText(title, { exact: true }).waitFor();
    const img = p.locator(`main img[src="${request.photo_url}"]`); await img.waitFor();
    await until(() => img.evaluate(e => e.complete && e.naturalWidth > 0), 'ატვირთული ფოტო არ ჩაიტვირთა');
  }, p);
  if (!request) return;
  await t.step('რედაქტირება და ვადის გაგრძელება', 'რაოდენობა 3 ხდება; ვადა იზრდება; UI ინახავს ცვლილებას', async () => {
    await p.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
    await p.locator('#quantity').fill('3'); await p.getByRole('button', { name: 'შენახვა', exact: true }).click();
    await p.locator('#new-request').waitFor({ state: 'hidden' });
    assert.equal(Number((await requestRow(p, request.id)).quantity), 3);
    await p.getByRole('button', { name: /^ვადის გაგრძელება/ }).click();
    await until(async () => Date.parse((await requestRow(p, request.id)).expires_at) > Date.parse(request.expires_at), 'ვადა არ გაზრდილა');
  }, p);
  await t.step('დახურვა და ხელახლა გახსნა', 'UI იცვლება; status closed შემდეგ open ხდება', async () => {
    // Closing lives under „სხვა მოქმედებები“ and asks for confirmation; reopening is the +7 days button.
    await p.locator('.request-manage-more summary').click();
    await p.getByRole('button', { name: 'მოთხოვნის დახურვა' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'დახურვა', exact: true }).and(p.locator(':not(.ma-sheet__close)')).click();
    await p.getByRole('button', { name: /^ხელახლა გახსნა/ }).waitFor();
    await until(async () => (await requestRow(p, request.id)).status === 'closed', 'status closed არ გახდა');
    await p.getByRole('button', { name: /^ხელახლა გახსნა/ }).click();
    await p.getByRole('button', { name: /^ვადის გაგრძელება/ }).waitFor();
    await until(async () => (await requestRow(p, request.id)).status === 'open', 'status open არ გახდა');
  }, p);
}
