// Page walk for client.mjs. Forms are opened and filled locally, never submitted; writes are blocked by client.mjs.
const REVIEW = 'fb2d9c2f-acef-4cde-be59-f1686aaf14ad'; // owner's request with 2 offers (state: reviewing)
const CHOSEN_TITLE = '[ux-audit] სასტუმროს ტექსტილი'; // owner's request with a chosen supplier (chat button)

export async function run({ page, shot, settle, report, origin, out }) {
  const note = (k, v) => { (report.notes ||= {})[k] = v; console.log('note', k, JSON.stringify(v).slice(0, 400)); };

  // Account root: client lands on "my requests"; the dashboard is company-only.
  await shot('account-root', '/account/');
  note('account-root-final', page.url().replace(origin, ''));
  await shot('account-overview-param', '/account/?tab=overview', { widths: [1440] });
  note('overview-param-heading', await page.locator('main h1').first().innerText().catch(() => null));

  // Sidebar at 390: viewport-only shot of the top + nav metrics.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/account/', { waitUntil: 'domcontentloaded' }); await settle();
  await page.screenshot({ path: `${out}/sidebar-top-390.jpg`, type: 'jpeg', quality: 70 });
  note('nav-390', await page.evaluate(() => { const n = document.querySelector('nav[aria-label="ანგარიშის განყოფილებები"]'); if (!n) return null; const r = n.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), scrollW: n.scrollWidth, clientW: n.clientWidth, items: [...n.querySelectorAll('a')].map(a => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), cur: a.getAttribute('aria-current'), w: Math.round(a.getBoundingClientRect().width), x: Math.round(a.getBoundingClientRect().left) })) }; }));

  // Status filters.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/account/', { waitUntil: 'domcontentloaded' }); await settle();
  const group = page.getByRole('group', { name: 'მოთხოვნის სტატუსი' });
  const labels = await group.getByRole('button').allInnerTexts().catch(() => []);
  note('request-filters', labels);
  for (const [i, text] of labels.entries()) {
    if (i === 0) continue;
    await group.getByRole('button').nth(i).click(); await page.waitForTimeout(400);
    await shot(`requests-filter-${i}`, null, { widths: [1440, 390] });
    await page.setViewportSize({ width: 1440, height: 1000 });
    note(`filter-${text.replace(/\s+/g, ' ')}`, await page.locator('.account-request-card, .account-empty-state').allInnerTexts());
  }

  // Chat popup from the chosen request row.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.goto(origin + '/account/', { waitUntil: 'domcontentloaded' }); await settle();
    const row = page.locator('.account-request-card').filter({ hasText: CHOSEN_TITLE });
    const chat = row.getByRole('button', { name: 'ჩატი' });
    if (await chat.count()) {
      await chat.click(); await page.waitForTimeout(2500);
      await shot('chatpopup', null, { widths: [width], full: false });
      note(`chatpopup-${width}`, await page.locator('[role="dialog"]').allInnerTexts().catch(() => []));
    } else note('chatpopup', 'no chat button');
  }

  for (const [name, url] of [['deals', '/account/?tab=deals'], ['saved', '/account/?tab=saved'], ['notifications', '/account/?tab=notifications'], ['messages', '/account/?tab=messages'], ['profile', '/account/?tab=profile']]) await shot(name, url);

  // Notification filters.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/account/?tab=notifications', { waitUntil: 'domcontentloaded' }); await settle();
  note('notification-filters', await page.locator('[aria-label="შეტყობინებების ტიპი"] button').allInnerTexts().catch(() => []));

  // Inbox: open first conversation (desktop + mobile thread view).
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.goto(origin + '/account/?tab=messages', { waitUntil: 'domcontentloaded' }); await settle();
    const first = page.locator('[aria-label="მიმოწერები"] li a, [aria-label="მიმოწერები"] li button, [aria-label="მიმოწერები"] [role="option"]').first();
    if (await first.count()) { await first.click(); await page.waitForTimeout(2500); await shot('messages-thread', null, { widths: [width], full: false }); }
    else note('inbox', 'no conversation item found');
  }

  // Profile: empty-submit validation of the company upgrade (client-side check only; become_company is blocked anyway).
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/account/?tab=profile', { waitUntil: 'domcontentloaded' }); await settle();
  const upgrade = page.locator('#company-upgrade');
  // After F2 the upgrade is its own card with a CTA; the old submit button may not be there.
  const upgradeSubmit = upgrade.getByRole('button', { name: 'კომპანიის პროფილის შექმნა' });
  if (await upgrade.count() && await upgradeSubmit.count()) {
    await upgradeSubmit.click(); await page.waitForTimeout(600);
    await upgrade.screenshot({ path: `${out}/profile-upgrade-errors-1440.jpg`, type: 'jpeg', quality: 70 });
    note('upgrade-errors', await upgrade.innerText());
  }
  // Password form empty submit (client validation only).
  await page.locator('#account-password').getByRole('button', { name: 'პაროლის შეცვლა' }).click(); await page.waitForTimeout(500);
  note('password-errors', await page.locator('#account-password').innerText());
  await page.locator('#account-password').screenshot({ path: `${out}/profile-password-errors-1440.jpg`, type: 'jpeg', quality: 70 });

  // Post request: 3 reachable steps without publishing.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.goto(origin + '/terms/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(origin + '/requests/new/', { waitUntil: 'domcontentloaded' }); await settle(); await page.locator('#title').waitFor({ timeout: 30000 });
    note(`post-initial-${width}`, { url: page.url().replace(origin, ''), title: await page.locator('#title').inputValue() });
    await shot('post-step1', null, { widths: [width] });
    await page.locator('.post-actions__next').click(); await page.waitForTimeout(600);
    await shot('post-step1-errors', null, { widths: [width] });
    note(`post-errors-${width}`, await page.locator('.ma-field__error, [id$="-error"]').allInnerTexts());
    await page.locator('#title').fill('QA ტესტი — არ გამოქვეყნდეს');
    await page.getByRole('combobox', { name: /კატეგორია/ }).click(); await page.locator('[role="option"]:not([aria-disabled="true"])').filter({ visible: true }).nth(1).click();
    await page.locator('#body').fill('სატესტო აღწერა, ფორმის შემოწმება.');
    await page.locator('#quantity').fill('10');
    await page.waitForTimeout(3600); // lets the 3s server autosave fire (blocked + logged)
    await shot('post-step1-filled', null, { widths: [width] });
    await page.screenshot({ path: `${out}/post-actions-viewport-${width}.jpg`, type: 'jpeg', quality: 70 });
    note(`post-actions-${width}`, await page.locator('.post-actions__buttons button, .post-actions__buttons a').evaluateAll(b => b.map(x => ({ t: x.innerText.trim(), w: Math.round(x.getBoundingClientRect().width), sw: x.scrollWidth, cw: x.clientWidth, l: Math.round(x.getBoundingClientRect().left) }))));
    await page.locator('.post-actions__next').click(); await page.waitForTimeout(800);
    await shot('post-step2', null, { widths: [width] });
    const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').fill(d);
    await page.locator('.post-actions__next').click(); await page.waitForTimeout(800);
    await shot('post-step3', null, { widths: [width] });
    note(`post-step3-text-${width}`, (await page.locator('main').innerText()).slice(0, 1500));
    await page.getByRole('button', { name: 'უკან' }).click(); await page.waitForTimeout(500);
    note(`post-back-${width}`, page.url().replace(origin, ''));
  }
  note('post-local-draft', await page.evaluate(() => Object.keys(localStorage).filter(k => /draft/i.test(k))));
  await shot('account-with-local-draft', '/account/', { widths: [1440] });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/draft/i.test(k)) localStorage.removeItem(k); });

  // Owner view of a request with offers, compare page, matching.
  await shot('request-view-owner', `/requests/view/?id=${REVIEW}`);
  note('request-view-ctas', await page.locator('main a, main button').evaluateAll(els => els.filter(e => e.offsetParent).map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + `/requests/view/?id=${REVIEW}`, { waitUntil: 'domcontentloaded' }); await settle();
  note('request-view-ctas-1440', await page.locator('main a, main button').evaluateAll(els => els.filter(e => e.offsetParent).map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)));
  const choose = page.getByRole('button', { name: 'არჩევა', exact: true }).first();
  if (await choose.count()) { await choose.click(); await page.waitForTimeout(900); await shot('choose-sheet', null, { widths: [1440], full: false }); note('choose-sheet', await page.locator('[role="dialog"]').allInnerTexts()); await page.keyboard.press('Escape'); }
  await shot('compare', `/requests/compare/?id=${REVIEW}`);
  await shot('matching', '/matching/');
}
