// P12 T12.3e: company profile coordinates, admin user count label, manual choose-offer check.
// Run: QA_ORIGIN=http://localhost:3001 node qa/profile-coords-shots.mjs
// Coordinates are only typed (never saved). The choose check creates one "[e2e:<run>]" request,
// a demo company offers on it, the demo client chooses it; the run is cleaned up at the end.
import path from 'node:path';
import { chromium } from 'playwright';
import { assert, go as goTo, requestPath, requestRow, db, root, safe, Scenario } from './e2e/lib.mjs';

const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(root, 'qa/shots/ideal-0924');
const browser = await chromium.launch({ headless: true, executablePath });
const t = new Scenario(browser, 'choose-manual', `${Date.now()}-t123e`);
const report = {};
const go = (p, route) => { report.at = route; return goTo(p, route); };
async function shot(p, name) {
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.waitForTimeout(300);
  report[name] = { overflow: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
  await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
}

try {
  // (1) company profile — coordinates (typed, not saved)
  const company = await t.page('wood');
  await go(company, '/account/?tab=profile');
  await company.locator('#lat').fill('41.7151');
  await company.locator('#lng').fill('');
  await company.getByRole('button', { name: 'შენახვა', exact: true }).click();
  report.missingLng = await company.locator('#lng-error').innerText();
  assert.equal(await company.locator('#lng').getAttribute('aria-invalid'), 'true');
  await company.locator('#lat').fill('141');
  await company.locator('#lng').fill('44.8271');
  await company.getByRole('button', { name: 'შენახვა', exact: true }).click();
  report.latRange = await company.locator('#lat-error').innerText();
  await company.locator('#lat').fill('41,7151');
  await company.locator('#lat').evaluate(e => e.closest('fieldset').previousElementSibling.scrollIntoView({ block: 'start' }));
  report.inputmode = await company.locator('#lat').getAttribute('inputmode');
  await shot(company, 'profile-coordinates-1440');
  await company.locator('#lat').fill('141');
  await company.getByRole('button', { name: 'შენახვა', exact: true }).click();
  await company.locator('#lat-error').waitFor();
  await company.locator('#lat').evaluate(e => e.closest('fieldset').scrollIntoView({ block: 'center' }));
  await company.screenshot({ path: path.join(out, 'profile-coordinates-error-1440.png') });

  // (2) admin — user count label
  const admin = await t.page('admin');
  await go(admin, '/admin/?tab=users');
  await admin.locator('tbody tr').first().waitFor();
  report.adminKpi = await admin.locator('.ma-stat').first().innerText();
  report.adminCount = await admin.locator('[role="status"]').first().innerText().catch(() => '');
  await shot(admin, 'admin-users-1440');

  // (3) choose an offer, no HMR involved
  const client = await t.page('hotel');
  const request = await t.fixture(client, 'არჩევა ხელით');
  await go(company, requestPath(request.id));
  await company.locator('#of-body').fill('მაგიდას მოგაწვდით ადგილზე აწყობით. ' + t.marker);
  await company.locator('#of-days').fill('4');
  await company.getByRole('button', { name: 'შეთავაზების გაგზავნა', exact: true }).click();
  await company.getByRole('button', { name: 'შეთავაზების რედაქტირება', exact: true }).waitFor();
  const started = Date.now();
  await client.goto(new URL(requestPath(request.id), process.env.QA_ORIGIN || 'http://localhost:3001').href, { waitUntil: 'domcontentloaded' });
  await client.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).first().waitFor({ timeout: 20000 });
  report.detailReadyMs = Date.now() - started;
  await client.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).first().click();
  await client.locator('#choose').getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
  await client.locator('#choose').waitFor({ state: 'hidden' });
  const celebrate = client.locator('dialog[open]').filter({ hasText: 'შედგა' });
  report.celebrate = await celebrate.isVisible({ timeout: 5000 }).catch(() => false) || await celebrate.waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (report.celebrate) await client.screenshot({ path: path.join(out, 'choose-celebrate-1440.png') });
  const row = await requestRow(client, request.id);
  const offer = (await db(client, `offers?select=id,status&request_id=eq.${request.id}`))[0];
  report.chosen = { chosenMatches: row.chosen_offer_id === offer.id, offerStatus: offer.status };
  if (report.celebrate) await client.keyboard.press('Escape');
  report.statusText = await client.locator('main').getByText('მომწოდებელი არჩეულია').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  await shot(client, 'choose-chosen-1440');
  await client.reload({ waitUntil: 'domcontentloaded' });
  report.statusAfterReload = await client.locator('main').getByText('მომწოდებელი არჩეულია').first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  report.network = client.qaNetwork.filter(n => n.error || n.status >= 500);
} catch (e) {
  report.error = safe(e.message);
  report.failedNetwork = t.contexts.flatMap(c => c.pages()).flatMap(p => p.qaNetwork || []);
  process.exitCode = 1;
} finally {
  await t.cleanup().catch(e => { report.cleanupError = safe(e.message); });
  report.cleanup = t.cleanupLog.map(l => l.restore || l.status || Object.keys(l)[0]);
  await browser.close();
  console.log(safe(JSON.stringify(report, null, 2)));
}
