import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { signedContext, settle } from './measure.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3445', AUTH = process.env.AUTH || 'http://127.0.0.1:4445';
const out = 'qa/LAYOUT-2026-10-14/profile';
const photoOrigin = execFileSync('psql', ['-d', 'meetany_layout_profile', '-Atc', 'select meetany_private.photo_origin()'], { encoding: 'utf8' }).trim();
const ids = { company: '74cc28fc-47de-45cb-9563-93735b86855e', client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c' };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const result = { checks: [], errors: [] };
function check(name) { result.checks.push(name); console.log('PASS', name); }
try {
  for (const role of ['company', 'client']) {
    const jwt = (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
    async function rpc(name, body = {}) {
      const response = await fetch(`${BASE}/api/db/rpc/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200, `${name}: ${await response.clone().text()}`);
      const data = await response.json(); return Array.isArray(data) ? data[0] : data;
    }
    const original = await rpc('my_profile');
    const context = await signedContext(browser, role), page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.message));
    // Never delete or upload a real Blob when testing a local database snapshot.
    await context.route('**/api/blob-upload', route => route.fulfill({ status: 503, json: { error: 'Local QA upload fixture' } }));
    try {
      await page.goto(BASE + '/account/?tab=profile'); await settle(page);
      const basic = page.locator('#profile-basic'), save = basic.getByRole('button', { name: 'შენახვა', exact: true });
      assert(await save.isDisabled());
      await page.locator('#name').fill(original.name + ' QA');
      assert(await save.isEnabled());
      if (role === 'company') await page.locator('#about').fill(original.about + ' QA draft');
      await save.click();
      await basic.getByRole('status').filter({ hasText: 'შენახულია ·' }).waitFor();
      assert(await save.isDisabled());
      const saved = await rpc('my_profile');
      assert.equal(saved.name, original.name + ' QA');
      if (role === 'company') {
        assert.equal(saved.about, original.about);
        assert.equal(await page.locator('#about').inputValue(), original.about + ' QA draft');
        assert(await page.locator('#profile-description').getByRole('button', { name: 'შენახვა', exact: true }).isEnabled());
        check('company: saving one dirty block preserves the other draft and server value');
        await page.locator('.company-profile-sections a[href*="section=legal"]').click();
        await page.getByRole('dialog', { name: 'შეუნახავი ცვლილებები' }).waitFor();
        await page.getByRole('button', { name: 'დარჩით', exact: true }).click();
        assert.equal(await page.locator('#about').inputValue(), original.about + ' QA draft');
        await page.locator('#about').fill(original.about);
        check('company: dirty navigation guard and stay preserve draft');
      }
      await basic.getByRole('status').filter({ hasText: 'ცვლილებები არ არის' }).waitFor({ timeout: 5000 });
      await page.reload(); await settle(page);
      assert.equal(await page.locator('#name').inputValue(), original.name + ' QA');
      check(`${role}: disabled → dirty → real database save → timed feedback → reload persistence`);
      await page.locator('#name').fill(original.name);
      await basic.getByRole('button', { name: 'შენახვა', exact: true }).click();
      await basic.getByRole('status').filter({ hasText: 'შენახულია ·' }).waitFor();
      if (role === 'company') {
        // Validation in another block cannot prevent a valid basic block save.
        await page.locator('.account-location-details summary').click();
        await page.locator('#lat').fill('999');
        await page.locator('#name').fill(original.name + ' QA');
        await basic.getByRole('button', { name: 'შენახვა', exact: true }).click();
        await basic.getByRole('status').filter({ hasText: 'შენახულია ·' }).waitFor();
        assert.equal((await rpc('my_profile')).lat, original.lat);
        await page.locator('#profile-location').getByRole('button', { name: 'შენახვა', exact: true }).click();
        await page.locator('#profile-location .account-section__footer [role=alert]').waitFor();
        await page.locator('#lat').fill(String(original.lat ?? ''));
        check('company: block-scoped coordinate validation and footer error');
        await page.locator('#about').fill(original.about + ' failed draft');
        await context.route('**/api/db/rpc/update_my_profile', route => route.fulfill({ status: 500, json: { message: 'Local QA failure' } }));
        await page.locator('#profile-description').getByRole('button', { name: 'შენახვა', exact: true }).click();
        await page.locator('#profile-description .account-section__footer [role=alert]').waitFor();
        assert(await page.locator('#profile-description').getByRole('button', { name: 'შენახვა', exact: true }).isEnabled());
        await context.unroute('**/api/db/rpc/update_my_profile');
        await page.locator('#about').fill(original.about);
        check('company: failed RPC stays dirty and reports the error in its own footer');
        const image = fs.readFileSync('public/assets/apple-touch-icon.png');
        await page.locator('#profile-logo').setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer: image });
        assert(await page.locator('#profile-media').getByRole('button', { name: 'შენახვა', exact: true }).isEnabled());
        await page.locator('#profile-media').getByRole('button', { name: 'შენახვა', exact: true }).click();
        await page.locator('#profile-media .account-section__footer [role=alert]').waitFor();
        assert(await page.locator('#profile-media [data-kind=logo] img').count());
        check('company: logo selection, local preview and upload failure retain the unsaved file');
        await context.unroute('**/api/blob-upload');
        const clientToken = 'vercel_blob_client_qalocal_' + Buffer.from('header.' + Buffer.from(JSON.stringify({ allowedContentTypes: ['image/png'], maximumSizeInBytes: 5242880 })).toString('base64') + '.signature').toString('base64');
        await context.route('**/api/blob-upload', route => route.fulfill({ json: route.request().method() === 'DELETE' ? {} : { clientToken } }));
        await context.route('https://vercel.com/api/blob/**', route => {
          const pathname = new URL(route.request().url()).searchParams.get('pathname');
          const url = `${photoOrigin}/${pathname}`;
          return route.fulfill({ json: { url, downloadUrl: url, pathname, contentType: 'image/png', contentDisposition: 'inline', etag: 'local-fixture' } });
        });
        await context.route(`${photoOrigin}/${ids[role]}/**`, route => route.fulfill({ contentType: 'image/png', body: image }));
        await context.route(url => url.pathname.replace(/\/$/, '') === '/_next/image', route => {
          const source = new URL(route.request().url()).searchParams.get('url');
          return source?.startsWith(`${photoOrigin}/${ids[role]}/`) ? route.fulfill({ contentType: 'image/png', body: image }) : route.continue();
        });
        await page.locator('#profile-gallery').setInputFiles({ name: 'gallery.png', mimeType: 'image/png', buffer: image });
        await page.locator('#profile-media').getByRole('button', { name: 'შენახვა', exact: true }).click();
        await page.locator('#profile-media').getByRole('status').filter({ hasText: 'შენახულია ·' }).waitFor();
        const media = await rpc('my_profile');
        assert(media.logo_url.startsWith(photoOrigin + '/'));
        assert.equal(media.gallery.length, original.gallery.length + 1);
        await page.reload(); await settle(page);
        assert(await page.locator('#profile-media [data-kind=logo] img').count());
        assert.equal(await page.locator('#profile-media [data-kind=gallery] li[draggable]').count(), original.gallery.length + 1);
        check('company: logo and gallery SDK upload fixture → real local RPC → reload persistence');
        for (const width of [390,360,320]) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), 0);
        }
        check('company: uploaded logo and gallery have no overflow at 390/360/320');
        await page.locator('#profile-media').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.locator('#profile-media').screenshot({ path: `${out}/functional-blocks.png`, animations: 'disabled' });
      }
    } finally {
      await context.close();
      await rpc('update_my_profile', { p_name: original.name, p_company: original.company || '', p_city: original.city, p_industry: original.industry, p_about: original.about || '', p_offers: original.offers || [], p_seeks: original.seeks || [], p_service_cities: original.service_cities || [], p_address: original.address, p_lat: original.lat, p_lng: original.lng, p_logo_url: role === 'company' ? original.logo_url || '' : null });
      if (role === 'company') await rpc('set_my_gallery', { p_urls: original.gallery });
    }
  }
} catch (error) { result.errors.push(error.stack); process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync(`${out}/functional.json`, JSON.stringify(result, null, 2)); }
assert.deepEqual(result.errors, []);
