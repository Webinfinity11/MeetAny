import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { request } from 'playwright';
import { upload } from '@vercel/blob/client';
import { credentials, auth, query, root, safe } from '../qa/e2e/lib.mjs';

// Photos and disclosure only, pinned to existing demo identities and the v3 ledger.
// No account, request, offer, review or workflow state is created or changed.
const apply = process.argv.includes('--apply');
const origin = 'https://www.meetany.ge';
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
assert.equal(ledger.v3.marker, 'meetany-demo-cycle-2026-10-08-v3');
const journalFile = path.join(root, '../DEMO-PHOTOS.local.json');
const journal = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile)) : {};
const save = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
const companyPhotos = { wood: 'companies/joinery.jpg', linen: 'companies/linen.jpg', supply: 'companies/wholesale.jpg', food: 'companies/produce.jpg', cleaning: 'commercial-cleaning.jpg', build: 'construction-interior.jpg', web: 'technology-office.jpg', port: 'companies/port.jpg', code: 'companies/it.jpg', ads: 'creative-team.jpg' };
const requestPhotos = { furniture: 'companies/joinery.jpg', textiles: 'companies/linen.jpg', laundry: 'hotel-linen.jpg', freight: 'companies/port.jpg', software_web: 'technology-office.jpg', food_fresh: 'companies/produce.jpg', branding_design: 'creative-team.jpg', renovation: 'construction-interior.jpg', cleaning: 'commercial-cleaning.jpg' };
let context;
try {
  const profiles = await query('select * from public.profiles where id=any($1::uuid[])', [Object.keys(companyPhotos).map(k => ledger.accounts[k].id)]);
  const rows = await query('select * from public.requests where id=any($1::uuid[])', [Object.values(ledger.v3.requests).map(r => r.id)]);
  assert.equal(rows.length, 20);
  for (const [key] of Object.entries(companyPhotos)) {
    const p = profiles.find(p => p.id === ledger.accounts[key].id);
    assert(p && p.role === 'company' && !p.blocked && p.email === `demo-${key}@meetany.ge`, 'Demo company identity mismatch');
  }
  for (const row of rows) {
    const a = Object.entries(ledger.accounts).find(([, a]) => a.id === row.owner_id);
    assert(a && credentials(a[0]).email === `demo-${a[0]}@meetany.ge`, 'Non-demo request refused');
    assert(requestPhotos[row.category] && !row.hidden, 'Unsupported demo request');
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', companies: profiles.length, requests: rows.length, missingRequestPhotos: rows.filter(r => !r.photo_url).length, workflow: 'preserved', photos: 'existing licensed illustrative assets' }));
  if (apply) {
    context = await request.newContext({ timeout: 15000 });
    const login = await context.post(auth + '/sign-in/email', { data: credentials('owner_admin') });
    assert(login.ok(), `Admin login HTTP ${login.status()}`);
    const jwt = (await (await context.get(auth + '/token')).json()).token;
    async function rpc(name, args) {
      const r = await context.post(origin + '/api/db/rpc/' + name, { data: args, headers: { Authorization: 'Bearer ' + jwt } });
      assert(r.ok(), `${name}: HTTP ${r.status()}`);
      return r.json();
    }
    const me = (await rpc('my_profile', {}))[0];
    assert(me.id === ledger.accounts.owner_admin.id && me.role === 'admin', 'Admin mismatch');
    async function photo(owner, asset, purpose) {
      const key = `${owner}:${asset}:${purpose}`;
      if (!journal[key]) {
        const result = await upload(`${owner}/${purpose}-demo-photo-${Date.now()}.jpg`, fs.readFileSync(path.join(root, 'public/assets/photos', asset)), { access: 'public', handleUploadUrl: origin + '/api/blob-upload', contentType: 'image/jpeg', headers: { Authorization: 'Bearer ' + jwt } });
        journal[key] = result.url; save();
      }
      return journal[key];
    }
    for (const [key, asset] of Object.entries(companyPhotos)) {
      const p = (await query('select * from public.profiles where id=$1', [ledger.accounts[key].id]))[0];
      const url = await photo(p.id, asset, 'gallery');
      const gallery = [url, ...p.gallery.filter(v => v !== url)];
      assert(gallery.length <= 8, 'Gallery full; refusing overwrite');
      const about = p.about.startsWith('სადემო კომპანია.') ? p.about : `სადემო კომპანია. ინფორმაცია და ფოტოები საილუსტრაციოა. ${p.about}`;
      assert(about.length <= 1000);
      await rpc('admin_edit_profile', { p_id: p.id, p_patch: { gallery, about } });
      const updated = (await query('select * from public.profiles where id=$1', [p.id]))[0];
      for (const k of Object.keys(p).filter(k => !['gallery', 'about', 'updated_at'].includes(k))) assert.deepEqual(updated[k], p[k], 'Unexpected profile change');
      console.log('PASS company photo:', key);
    }
    for (const original of rows) {
      const row = (await query('select * from public.requests where id=$1', [original.id]))[0];
      assert.equal(row.owner_id, original.owner_id);
      const body = row.body.startsWith('სადემო განცხადება.') ? row.body : `სადემო განცხადება. პროცესის საჩვენებელი მაგალითი; ფოტო საილუსტრაციოა.\n\n${row.body}`;
      assert(body.length <= 2000);
      const photoUrl = row.photo_url || await photo(row.owner_id, requestPhotos[row.category], 'request');
      await rpc('admin_edit_request', { p_id: row.id, p_patch: { photo_url: photoUrl, body } });
      const updated = (await query('select * from public.requests where id=$1', [row.id]))[0];
      for (const k of Object.keys(row).filter(k => !['photo_url', 'body', 'updated_at'].includes(k))) assert.deepEqual(updated[k], row[k], 'Unexpected request/workflow change');
    }
    console.log('PASS 20 illustrated demo requests; ownership, offers and deal stages preserved.');
  }
} catch (error) {
  console.error(safe(error?.code === 'ERR_ASSERTION' ? error.message : 'Photo enrichment failed; inspect privately.'));
  process.exitCode = 1;
} finally { await context?.dispose(); }
