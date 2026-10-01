import { assert, db, rpc, go, until, choose } from '../lib.mjs';
export default async function guest(t) {
  const p = await t.page();
  const admin = await t.page('owner_admin');
  const requests = await db(p, 'requests?select=*');
  const companies = await rpc(p, 'list_companies');
  let requestLink, companyLink;
  await t.step('მოთხოვნები: სია და დეტალი', 'სიის ID-ები GET requests-შია; დეტალის სათაური ემთხვევა', async () => {
    await go(p, '/requests/');
    const links = p.locator('main a[href^="/requests/view/?id="]'); await links.first().waitFor();
    requestLink = await links.first().getAttribute('href');
    const id = new URL(requestLink, p.url()).searchParams.get('id');
    assert(requests.some(r => r.id === id));
    await links.first().click(); await p.waitForURL('**' + requestLink); await p.getByRole('heading', { name: requests.find(r => r.id === id).title, exact: true }).waitFor();
  }, p);
  await t.step('მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება', 'URL და ხილული შედეგები შეესაბამება მონაცემებს', async () => {
    await go(p, '/requests/');
    const search = p.locator('main input[role="combobox"]');
    await search.fill('არარსებულიმოთხოვნა' + t.run);
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('q')?.includes(t.run)), 'q URL-ში არ შეიცვალა');
    await until(async () => await p.locator('main a[href^="/requests/view/?id="]').count() === 0, 'ძიებამ შედეგები არ გაფილტრა');
    await search.fill(''); await search.press('Escape');
    await choose(p, '#desktop-city', 'batumi');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('city') === 'batumi'), 'city URL-ში არ შეიცვალა');
    await p.locator('main a[href^="/requests/view/?id="]').first().waitFor();
    const ids = await p.locator('main a[href^="/requests/view/?id="]').evaluateAll(a => a.map(x => new URL(x.href).searchParams.get('id')));
    assert(ids.length && ids.every(id => requests.find(r => r.id === id)?.city === 'batumi'));
    // The „ყველა / ახალი / მალე იწურება“ tabs were removed; old ?tab= links now map to the sort.
    await choose(p, '#desktop-city', '');
    await until(() => Promise.resolve(!new URL(p.url()).searchParams.has('city')), 'ქალაქი არ გასუფთავდა');
    await choose(p, '#sort', 'expiring');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('sort') === 'expiring'), 'sort URL-ში არ შეიცვალა');
    const ordered = await p.locator('.request-card').evaluateAll(cards => cards.map(c => ({ id: new URL(c.querySelector('a').href).searchParams.get('id'), tier: c.classList.contains('request-card--vip') ? 'vip' : c.classList.contains('request-card--top') ? 'top' : 'normal' })));
    assert(ordered.length > 0);
    for (const tier of ['vip','top','normal']) {
      const dates = ordered.filter(r => r.tier === tier).map(r => Date.parse(requests.find(x => x.id === r.id).expires_at));
      assert.deepEqual(dates, [...dates].sort((a,b) => a-b), 'ვადის დალაგება არასწორია: ' + tier);
    }
  }, p);
  await t.step('კომპანიები: ძიება, ფილტრი და დალაგება', 'URL იცვლება; ID-ები, ქალაქი და სახელების მიმდევრობა სწორია', async () => {
    await go(p, '/companies/');
    const links = () => p.locator('main a[href^="/companies/view/?id="]'); await links().first().waitFor();
    companyLink = await links().first().getAttribute('href');
    const search = p.locator('main input[role="combobox"]');
    await search.fill('არარსებულიკომპანია' + t.run);
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('q')?.includes(t.run)), 'q URL-ში არ შეიცვალა');
    await until(async () => await links().count() === 0, 'ძიებამ კომპანიები არ გაფილტრა');
    await search.fill(''); await search.press('Escape');
    await choose(p, '#desktop-city', 'tbilisi');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('city') === 'tbilisi'), 'city URL-ში არ შეიცვალა');
    await links().first().waitFor();
    await choose(p, '#sort', 'newest');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('sort') === 'newest'), 'sort URL-ში არ შეიცვალა');
    const ids = [...new Set(await links().evaluateAll(a => a.map(x => new URL(x.href).searchParams.get('id'))))];
    const rows = ids.map(id => companies.find(c => c.id === id));
    assert(rows.length && rows.every(c => c && (c.city === 'tbilisi' || c.city === 'georgia' || c.service_cities.includes('tbilisi') || c.service_cities.includes('georgia'))));
    // The catalog has no name sort any more; "newest" orders by registration date, latest first.
    const created = rows.map(c => Date.parse(c.created_at ?? c.createdAt));
    if (created.every(Number.isFinite)) assert.deepEqual(created, [...created].sort((a,b) => b-a), 'უახლესის დალაგება არასწორია');
  }, p);
  await t.step('კომპანიის დეტალი, ნომერი, tel:, მიმართულება, contact_events', 'გამოჩენა/დარეკვა აღირიცხება; Maps სწორი ბმულია', async () => {
    assert(companyLink, 'კომპანიის ბმული არ არის'); await go(p, companyLink);
    const id = new URL(companyLink, p.url()).searchParams.get('id');
    const profile = (await db(p, `profiles?select=id,phone&id=eq.${id}`))[0];
    const response = p.waitForResponse(r => r.url().endsWith('/rpc/log_contact_event') && r.request().method() === 'POST');
    // The reveal button's label changed („ნომრის ნახვა“ → „დარეკვა“); its role in the flow did not.
    await p.locator('button[data-contact-action="reveal"]').first().click();
    const reveal = await (await response).json();
    const call = p.locator('a[data-contact-action="call"]').first();
    assert.equal(await call.getAttribute('href'), 'tel:' + profile.phone.replace(/[^+\d]/g, ''));
    assert((await call.innerText()).includes(profile.phone));
    // Prevent the OS dialer, while exercising React's click/analytics handler.
    await p.evaluate(() => document.addEventListener('click', e => { if(e.target.closest('a[href^="tel:"]')) e.preventDefault(); }));
    const callResponse = p.waitForResponse(r => r.url().endsWith('/rpc/log_contact_event') && r.request().method() === 'POST');
    await call.click(); const event = await (await callResponse).json();
    const events = await rpc(admin, 'admin_contact_events', { p_limit: 100 });
    for (const item of [reveal, event]) {
      assert(item.recorded && item.id, 'ახალი contact_event არ დამატებულა (შესაძლოა წუთობრივი dedupe)');
      assert(events.items.some(e => e.id === item.id && e.target_id === id));
    }
    const map = p.getByRole('link', { name: /მიმართულება|რუკაზე ნახვა/ });
    const href = await map.getAttribute('href'); assert(/https:\/\/(www\.)?google\.com\/maps/.test(href));
    return { contactEvents: [reveal.id, event.id], maps: href };
  }, p);
}
