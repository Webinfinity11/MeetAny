import { assert, db, rpc, go, until } from '../lib.mjs';
export default async function(t) {
  const p = await t.page();
  const admin = await t.page('admin');
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
    await p.locator('#request-city-desktop').selectOption('batumi');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('city') === 'batumi'), 'city URL-ში არ შეიცვალა');
    await p.locator('main a[href^="/requests/view/?id="]').first().waitFor();
    const ids = await p.locator('main a[href^="/requests/view/?id="]').evaluateAll(a => a.map(x => new URL(x.href).searchParams.get('id')));
    assert(ids.length && ids.every(id => requests.find(r => r.id === id)?.city === 'batumi'));
    await p.getByRole('link', { name: 'ახალი', exact: true }).click();
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('tab') === 'new'), 'tab URL-ში არ შეიცვალა');
    const fresh = await p.locator('main a[href^="/requests/view/?id="]').evaluateAll(a => a.map(x => new URL(x.href).searchParams.get('id')));
    assert(fresh.every(id => Date.now() - Date.parse(requests.find(r => r.id === id).created_at) < 864e5));
    await p.locator('#request-city-desktop').selectOption('');
    await until(() => Promise.resolve(!new URL(p.url()).searchParams.has('city')), 'ქალაქი არ გასუფთავდა');
    await p.locator('.request-board-tabs').getByRole('link', { name: 'ყველა', exact: true }).click();
    await until(() => Promise.resolve(!new URL(p.url()).searchParams.has('tab')), 'ყველა ჩანართი არ დაბრუნდა');
    await p.locator('#sort').selectOption('expiring');
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
    await p.locator('#company-city-desktop').selectOption('tbilisi');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('city') === 'tbilisi'), 'city URL-ში არ შეიცვალა');
    await links().first().waitFor();
    await p.locator('#sort').selectOption('name');
    await until(() => Promise.resolve(new URL(p.url()).searchParams.get('sort') === 'name'), 'sort URL-ში არ შეიცვალა');
    const ids = [...new Set(await links().evaluateAll(a => a.map(x => new URL(x.href).searchParams.get('id'))))];
    const rows = ids.map(id => companies.find(c => c.id === id));
    assert(rows.length && rows.every(c => c && (c.city === 'tbilisi' || c.city === 'georgia' || c.service_cities.includes('tbilisi') || c.service_cities.includes('georgia'))));
    const names = rows.map(c => c.company); assert.deepEqual(names, [...names].sort((a,b) => a.localeCompare(b, 'ka')));
  }, p);
  await t.step('კომპანიის დეტალი, ნომერი, tel:, მიმართულება, contact_events', 'გამოჩენა/დარეკვა აღირიცხება; Maps სწორი ბმულია', async () => {
    assert(companyLink, 'კომპანიის ბმული არ არის'); await go(p, companyLink);
    const id = new URL(companyLink, p.url()).searchParams.get('id');
    const profile = (await db(p, `profiles?select=id,phone&id=eq.${id}`))[0];
    const response = p.waitForResponse(r => r.url().endsWith('/rpc/log_contact_event') && r.request().method() === 'POST');
    await p.getByRole('button', { name: 'ნომრის ნახვა', exact: true }).first().click();
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
