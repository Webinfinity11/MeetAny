// ეტაპი 3, კომპანიის პროფილი და onboarding — after კადრები ლოკალურ სერვერზე.
// გაშვება: ORIGIN=http://localhost:3306 node qa/PERFECTION-2026-10-12/scripts/company-after.mjs
// ჩაწერის RPC-ები იბლოკება; ვერიფიკაციის მდგომარეობები (none/pending/returned) my_profile-ის პასუხის ჩანაცვლებით ჩანს, ბაზა არ იცვლება.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwCandidates = [process.env.PLAYWRIGHT_PATH, path.resolve(root, '../../node_modules/playwright/index.mjs'), '/Users/kapana/Desktop/infinty/MeetAny/site/web/node_modules/playwright/index.mjs'].filter(Boolean);
const { chromium } = await import(pathToFileURL(pwCandidates.find(p => fs.existsSync(p))).href);

const ORIGIN = (process.env.ORIGIN || 'http://localhost:3306').replace(/\/$/, '');
const ledgerPath = [path.resolve(root, '../../../DEMO-ACCOUNTS.local.md'), '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md'].find(p => fs.existsSync(p));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const accountKey = process.env.ACCOUNT || 'owner_company';
const account = { email: `demo-${accountKey}@meetany.ge`, ...ledger.accounts[accountKey] };
const only = process.env.PAGES ? new Set(process.env.PAGES.split(',')) : null;
const OUT = path.join(root, 'after/company', accountKey === 'owner_company' ? '' : accountKey);
fs.mkdirSync(OUT, { recursive: true });

const MUTATION = /^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|submit_|complete_|request_company_plan|cancel_|review_|admin_)/;
// owner_company is verified in the local copy; the live account is not. Unverified states are shown by rewriting my_profile.
let profileOverride = accountKey === 'owner_company' ? { verified: false, verification_documents_status: 'not_submitted' } : null;
const report = { origin: ORIGIN, account: account.email, blocked: [], pages: [] };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ka-GE' });
await context.route('**/api/**', async route => {
  const req = route.request();
  const rpc = new URL(req.url()).pathname.match(/\/api\/db\/rpc\/([^/?]+)/)?.[1];
  if (rpc && MUTATION.test(rpc)) { report.blocked.push(rpc); return route.fulfill({ status: 403, body: '{"message":"qa read-only"}', contentType: 'application/json' }); }
  if (rpc === 'my_profile' && profileOverride) {
    const response = await route.fetch();
    const body = await response.json();
    const patch = row => ({ ...row, ...profileOverride });
    return route.fulfill({ response, json: Array.isArray(body) ? body.map(patch) : patch(body) });
  }
  return route.continue();
});
const page = await context.newPage();
let bucket = [];
page.on('pageerror', e => bucket.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('qa read-only')) bucket.push({ type: 'console', text: m.text().slice(0, 300) }); });

const settle = async () => { await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700); };

async function shot(name, url, { prep } = {}) {
  if (only && !only.has(name.split('-')[0]) && !only.has(name)) return;
  for (const width of [1440, 390]) {
    bucket = [];
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle();
    if (prep) { await prep(page, width).catch(e => bucket.push({ type: 'prep', text: e.message })); await settle(); }
    const info = await page.evaluate(() => ({ h1: document.querySelector('h1')?.innerText || '', overflow: document.documentElement.scrollWidth - innerWidth, text: (document.querySelector('main') || document.body).innerText }));
    await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
    report.pages.push({ name, width, url, h1: info.h1, overflow: info.overflow, errors: bucket });
    fs.mkdirSync(path.join(OUT, 'text'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'text', `${name}-${width}.txt`), info.text);
    console.log(`${name}@${width} overflow=${info.overflow} errors=${bucket.length}${bucket.length ? ' ' + JSON.stringify(bucket) : ''} h1="${info.h1}"`);
  }
}

await page.goto(ORIGIN + '/account/', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email]').first().waitFor({ timeout: 30000 });
await page.locator('input[type=email]').first().fill(account.email);
await page.locator('input[type=password]').first().fill(account.password);
await page.locator('form.auth-controls button[type=submit]').first().click();
await page.waitForFunction(() => !document.querySelector('form.auth-controls input[type=password]'), null, { timeout: 30000 });
await settle();

for (const step of ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']) await shot(`onboarding-${step}`, `/onboarding/?step=${step}`);
await shot('onboarding-type-all', '/onboarding/?step=type', { prep: async p => { await p.getByRole('button', { name: /ყველა კატეგორია/ }).click(); } });
if (accountKey === 'owner_company') {
  for (const [state, override] of [['pending', { verified: false, verification_documents_status: 'pending' }], ['returned', { verified: false, verification_documents_status: 'rejected', verification_note: 'საგადასახადო დოკუმენტი წაუკითხავია — ატვირთეთ მკაფიო ასლი.' }]]) {
    profileOverride = override;
    await shot(`verification-${state}`, '/onboarding/?step=verify');
  }
  profileOverride = { verified: false, verification_documents_status: 'not_submitted' };
}
await shot('verification', '/onboarding/?step=verify');
await shot('products', '/account/?tab=profile&section=products');
await shot('distribution', '/account/?tab=profile&section=distribution');
await shot('business', '/account/?tab=business');

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
