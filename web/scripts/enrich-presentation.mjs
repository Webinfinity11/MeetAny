import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { request } from 'playwright';

async function main() {
// Default: SELECT-only preview. Apply only after the printed plan has been reviewed:
// node scripts/enrich-presentation.mjs --apply --expect-plan=<printed SHA256>
// Exact existing fixture IDs; never creates accounts, requests, reviews or messages.
const root = path.resolve(import.meta.dirname, '..');
const origin = 'https://meet-any.vercel.app';
const auth = 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
const allowedHosts = new Set(['ep-withered-glade-b54ts1g5-pooler.c-7.us-east-2.aws.neon.tech', 'ep-withered-glade-b54ts1g5.c-7.us-east-2.aws.neon.tech']);
const args = process.argv.slice(2);
assert(args.every(v => v === '--apply' || /^--expect-plan=[a-f0-9]{64}$/.test(v)), 'Unsupported argument');
const apply = args.includes('--apply');
const expectedPlan = args.find(v => v.startsWith('--expect-plan='))?.slice(14);
assert(!apply || expectedPlan, 'Apply requires --expect-plan=<reviewed SHA256>');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).flatMap(line => {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
assert(allowedHosts.has(new URL(env.DATABASE_URL).hostname), 'Unexpected database: refusing');
assert(env.NEON_AUTH_BASE_URL?.replace(/\/$/, '') === auth, 'Unexpected Auth origin: refusing');
const ledgerPath = [path.join(root, 'DEMO-ACCOUNTS.local.md'), path.join(root, '../DEMO-ACCOUNTS.local.md')].find(p => fs.existsSync(p));
assert(ledgerPath, 'Private fixture ledger missing');
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const adminId = 'd2517b00-554d-4e6b-929a-ef3da51f3b47';
assert.equal(ledger.accounts.owner_admin.id, adminId, 'Admin ledger identity changed');
const profiles = [
  { key: 'hotel', id: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', role: 'client', company: 'სასტუმრო „ლეგენდა“', patch: {
    about: 'ბათუმის სასტუმრო 30 ნომრით. ვეძებთ საიმედო პარტნიორებს თეთრეულის მომარაგების, საერთო სივრცეების დასუფთავებისა და რეგულარული გადაზიდვებისთვის. შეთავაზებაში გთხოვთ მიუთითოთ კომპლექტაცია, მომსახურების პირობები და ბათუმში მიწოდების შესაძლებლობა.'
  } },
  { key: 'wood', id: '74cc28fc-47de-45cb-9563-93735b86855e', role: 'company', company: 'ხის ხაზი', patch: {
    about: 'ვამზადებთ ხის ავეჯს კაფეებისთვის, სასტუმროებისა და მაღაზიებისთვის: მაგიდებს, სკამებსა და სავაჭრო თაროებს. სამუშაო იწყება ზომების, მასალისა და საფარის შეთანხმებით. დამზადებამდე ვამზადებთ ესკიზს; შეთავაზებაში ცალკე ვუთითებთ დამზადების, მიტანისა და მონტაჟის პირობებს. ვმუშაობთ თბილისსა და რუსთავში.',
    offers: ['ზომაზე დამზადებული ხის მაგიდები და სკამები', 'მაღაზიისა და კაფის სავაჭრო თაროები', 'ავეჯის მიტანა და მონტაჟი'],
    seeks: ['ხის მასალის მომწოდებლები', 'ავეჯის ფურნიტურა და დამცავი საფარები']
  } },
  { key: 'linen', id: '3d12ff1f-0d72-4a53-a92f-1830cfd5b290', role: 'company', company: 'რბილი სივრცე', patch: {
    about: 'ვკერავთ სასტუმროს თეთრეულს, ფარდებს, სუფრებსა და ხელსახოცებს ბიზნესისთვის. ქსოვილს, ზომასა და ფერს ნიმუშებით ვათანხმებთ; შეკვეთის მიხედვით ვგეგმავთ კომპლექტაციასა და შეფუთვას. შეთავაზებაში ვუთითებთ ქსოვილის შემადგენლობას, მოვლის წესებსა და დამზადების ვადას. მიწოდება შესაძლებელია ბათუმში, თბილისში და ქუთაისში.',
    offers: ['სასტუმროს თეთრეულის კომპლექტები', 'ზომაზე შეკერილი ფარდები', 'რესტორნის სუფრები და ხელსახოცები'],
    seeks: ['ბამბისა და სელის ქსოვილის მომწოდებლები', 'სასტუმროებისა და რესტორნების გრძელვადიანი შეკვეთები']
  } },
  { key: 'supply', id: 'cdb14451-5727-454e-9d04-6d47cf1d070e', role: 'company', company: 'რეგიონის მომარაგება', patch: {
    about: 'კაფეებს, სასტუმროებსა და მაღაზიებს ვაწვდით მზა ავეჯს, თეთრეულს, სამუშაო ინვენტარსა და შეფუთვის მასალებს. შეკვეთამდე ვაზუსტებთ საწყობის მარაგს, რაოდენობასა და კომპლექტაციას. საკუთარი ტრანსპორტით ვგეგმავთ მიწოდებას ქუთაისში, თბილისში, ბათუმსა და ზუგდიდში. ფასი და მიწოდების პირობები კონკრეტული შეკვეთის მიხედვით შეთანხმდება.',
    offers: ['მზა მაგიდები, სკამები და დივნები', 'სასტუმროსა და რესტორნის ინვენტარი', 'თეთრეული და მუყაოს შეფუთვა', 'შეკვეთის საკუთარი ტრანსპორტით მიწოდება'],
    seeks: ['ავეჯისა და ტექსტილის მწარმოებლები', 'შეფუთვის მასალების მომწოდებლები']
  } },
  { key: 'food', id: '85509946-985a-409d-86ad-26c87c185546', role: 'company', company: 'მთის ბაღი', patch: {
    about: 'კაფეებსა და სასტუმროებს ვამარაგებთ სეზონური ბოსტნეულით, ხილით, მწვანილითა და რძის ნაწარმით. ხელმისაწვდომი ასორტიმენტი სეზონის მიხედვით იცვლება. რეგულარული შეკვეთებისთვის წინასწარ ვათანხმებთ რაოდენობას, შეფუთვასა და კვირის მიწოდების გრაფიკს. ვმუშაობთ თბილისში, რუსთავსა და გორში; მიწოდებას ახლავს ანგარიშფაქტურა.',
    offers: ['სეზონური ბოსტნეული და მწვანილი', 'ხილი და კენკრა', 'ყველი და რძის ნაწარმი', 'წინასწარ შეთანხმებული გრაფიკით მომარაგება'],
    seeks: ['კაფეებისა და რესტორნების რეგულარული შეკვეთები', 'მაცივრიანი ტრანსპორტის პარტნიორები']
  } },
  { key: 'cleaning', id: '1a5b8b24-3854-434e-9081-e48e122c5918', role: 'company', company: 'სუფთა სივრცე', patch: {
    about: 'ვასუფთავებთ სასტუმროებს, ოფისებსა და კაფეებს ბათუმსა და ქუთაისში. მომსახურება მოიცავს გენერალურ და რემონტის შემდგომ დასუფთავებას, ასევე სასტუმროს თეთრეულის რეცხვასა და იჯარას. ვმუშაობთ საკუთარი ინვენტარითა და საწმენდი საშუალებებით. შეთავაზებამდე ვაზუსტებთ ფართობს, ზედაპირებსა და სამუშაო საათებს, რათა მომსახურება ობიექტის გრაფიკს მოერგოს.',
    offers: ['სასტუმროსა და ოფისის გენერალური დასუფთავება', 'რემონტის შემდგომი დასუფთავება', 'სასტუმროს თეთრეულის რეცხვა და იჯარა'],
    seeks: ['სასტუმროებისა და ოფისების რეგულარული მომსახურება', 'საწმენდი საშუალებების მომწოდებლები']
  } }
];
const hotelId = profiles[0].id;
const requests = [
  { key: 'weekly', id: '0101aaac-f4e6-4ed4-b1bd-5a52e0942db9', owner_id: hotelId, category: 'freight', patch: {
    title: 'თბილისი–ბათუმი: 3 პალეტის ყოველკვირეული გადაზიდვა',
    body: 'სასტუმროსთვის გვჭირდება კვირაში 3 პალეტის თეთრეულისა და ჰიგიენური საშუალებების გადაზიდვა თბილისის საწყობიდან ბათუმში. ვეძებთ მუდმივ პარტნიორს წინასწარ შეთანხმებული, კვირის ერთი და იმავე დღით. შეთავაზებაში მიუთითეთ მანქანის ტიპი, ტრანსპორტირების ღირებულება, დატვირთვა-ჩამოტვირთვის პირობები და მიტანის სავარაუდო დრო. პალეტების ზომებსა და წონას შეთანხმებისას დავაზუსტებთ.'
  } },
  { key: 'cleaning', id: 'b69007dd-c2e2-46f0-8d77-72adb252ce47', owner_id: hotelId, category: 'cleaning', patch: {
    body: 'სასტუმროს სტუმრების მიღებამდე გვჭირდება 450 კვ.მ საერთო სივრცის გენერალური დასუფთავება: დერეფნები, იატაკი და ფანჯრები. ინვენტარი და საწმენდი საშუალებები შემსრულებელმა უნდა მოიტანოს. გთხოვთ ცალკე მიუთითოთ სამუშაოს მოცულობა, გუნდის შემადგენლობა, შესრულების ხანგრძლივობა და სრული ღირებულება. სამუშაო საათებსა და ადგილზე დათვალიერებას წინასწარ შევათანხმებთ.'
  } }
];
for (const spec of profiles) {
  assert.equal(ledger.accounts[spec.key]?.id, spec.id, `Profile allowlist mismatch: ${spec.key}`);
  assert(spec.patch.about.length <= 1000, 'Profile text exceeds schema');
  assert(Object.keys(spec.patch).every(k => ['about', 'offers', 'seeks'].includes(k)), 'Forbidden profile patch');
}
for (const spec of requests) {
  assert.equal(ledger.v2.requests[spec.key], spec.id, `Request allowlist mismatch: ${spec.key}`);
  assert(spec.patch.body.length >= 10 && spec.patch.body.length <= 2000, 'Request body exceeds schema');
  assert(Object.keys(spec.patch).every(k => ['title', 'body'].includes(k)), 'Forbidden request patch');
}
const sql = neon(env.DATABASE_URL);
const query = (text, values = []) => sql.query(text, values, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function snapshot() {
  const profileRows = await query('select * from public.profiles where id=any($1::uuid[]) order by id', [[...profiles.map(v => v.id), adminId]]);
  const requestRows = await query('select * from public.requests where id=any($1::uuid[]) order by id', [requests.map(v => v.id)]);
  const capabilities = (await query("select meetany_private.photo_origin() as photo_origin, to_regprocedure('public.admin_edit_profile(uuid,jsonb)') is not null as profile_rpc, to_regprocedure('public.admin_edit_request(uuid,jsonb)') is not null as request_rpc"))[0];
  const administrator = profileRows.find(v => v.id === adminId);
  assert(administrator?.role === 'admin' && !administrator.blocked, 'Allowlisted admin unavailable');
  for (const spec of profiles) {
    const row = profileRows.find(v => v.id === spec.id);
    assert(row && row.role === spec.role && row.company === spec.company && !row.blocked, `Profile identity changed: ${spec.key}`);
    for (const photo of row.gallery || []) {
      const url = new URL(photo);
      assert(url.origin === capabilities.photo_origin && url.pathname.startsWith(`/${row.id}/gallery-`), `Invalid existing gallery origin/ownership: ${spec.key}`);
    }
  }
  for (const spec of requests) {
    const row = requestRows.find(v => v.id === spec.id);
    assert(row && row.owner_id === spec.owner_id && row.category === spec.category && !row.hidden && !row.chosen_offer_id, `Request identity/state changed: ${spec.key}`);
  }
  return { profileRows, requestRows, capabilities };
}
function planFor(state) {
  return [...profiles.map(v => ({ ...v, kind: 'profile', row: state.profileRows.find(r => r.id === v.id) })), ...requests.map(v => ({ ...v, kind: 'request', row: state.requestRows.find(r => r.id === v.id) }))].map(spec => ({
    kind: spec.kind, key: spec.key, id: spec.id,
    before: Object.fromEntries(Object.keys(spec.patch).map(k => [k, spec.row[k]])),
    patch: Object.fromEntries(Object.entries(spec.patch).filter(([k, v]) => JSON.stringify(spec.row[k]) !== JSON.stringify(v))),
    // Digest checks all original fields without exposing phones/email/credentials.
    baseline: hash(spec.row)
  }));
}
let context;
try {
  const before = await snapshot();
  const plan = planFor(before);
  const fingerprint = hash(plan);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only preview', origin, plan_sha256: fingerprint, changed_profiles: plan.filter(p => p.kind === 'profile' && Object.keys(p.patch).length).length, changed_requests: plan.filter(p => p.kind === 'request' && Object.keys(p.patch).length).length, prerequisites: before.capabilities, plan }, null, 2));
  if (apply) {
    assert.equal(fingerprint, expectedPlan, 'Plan changed since review; run a new read-only preview');
    assert(before.capabilities.profile_rpc && before.capabilities.request_rpc, 'Required admin migrations are not deployed');
    context = await request.newContext({ timeout: 15000 });
    const account = ledger.accounts.owner_admin;
    const login = await context.post(auth + '/sign-in/email', { data: { email: account.email, password: account.password } });
    assert(login.ok(), `Admin sign-in failed: HTTP ${login.status()}`);
    const tokenResult = await context.get(auth + '/token');
    assert(tokenResult.ok(), 'Admin JWT unavailable');
    const jwt = (await tokenResult.json()).token;
    assert(typeof jwt === 'string' && jwt.length > 20, 'Admin JWT missing');
    async function rpc(name, data = {}) {
      const result = await context.post(origin + '/api/db/rpc/' + name, { headers: { Authorization: 'Bearer ' + jwt }, data });
      assert(result.ok(), `RPC ${name}: HTTP ${result.status()}`);
      return result.json();
    }
    const me = (await rpc('my_profile'))[0];
    assert(me?.id === adminId && me.role === 'admin' && !me.blocked, 'Authenticated administrator identity mismatch');
    // Recheck complete snapshots after login and immediately before any write.
    assert.equal(hash(planFor(await snapshot())), fingerprint, 'Records changed before apply; refusing');
    for (const change of plan.filter(p => Object.keys(p.patch).length)) {
      const table = change.kind === 'profile' ? 'profiles' : 'requests';
      const current = (await query(`select * from public.${table} where id=$1::uuid`, [change.id]))[0];
      assert.equal(hash(current), change.baseline, `Concurrent edit detected: ${change.key}`);
      await rpc(change.kind === 'profile' ? 'admin_edit_profile' : 'admin_edit_request', { p_id: change.id, p_patch: change.patch });
      const updated = (await query(`select * from public.${table} where id=$1::uuid`, [change.id]))[0];
      for (const [field, value] of Object.entries(current)) {
        assert(hash(updated[field]) === hash(Object.hasOwn(change.patch, field) ? change.patch[field] : value), `Unexpected changed field: ${change.key}.${field}`);
      }
      console.log(`Verified exact patch: ${change.kind} ${change.key}`);
    }
    console.log('Presentation enrichment complete; identities, photos, permissions and transaction state preserved.');
  }
} catch (error) {
  // Never echo driver error messages/objects: they can contain connection strings.
  console.error(error?.code === 'ERR_ASSERTION' ? error.message : `Operation failed (${error?.name || 'unknown error'}); no credentials logged. Inspect privately.`);
  process.exitCode = 1;
} finally {
  await context?.dispose();
}

}
main().catch(error => {
  console.error(error?.code === 'ERR_ASSERTION' ? error.message : 'Guard/setup failed; no credentials logged.');
  process.exitCode = 1;
});
