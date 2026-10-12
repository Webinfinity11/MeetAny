// ეტაპი 1, კომპანიის ანგარიშის აუდიტი — მხოლოდ წაკითხვა.
// გაშვება: node scripts/company.mjs  (ORIGIN=https://www.meetany.ge ნაგულისხმევად)
// ყველა ცვლილების RPC, POST/PATCH/DELETE ცხრილებზე, ატვირთვა და ანალიტიკა იბლოკება და ილოგება.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwCandidates = [process.env.PLAYWRIGHT_PATH, path.join(root, 'web/node_modules/playwright/index.mjs'), '/Users/kapana/Desktop/infinty/MeetAny/site/web/node_modules/playwright/index.mjs'].filter(Boolean);
const { chromium } = await import(pathToFileURL(pwCandidates.find(p => fs.existsSync(p))).href);

const ORIGIN = (process.env.ORIGIN || 'https://www.meetany.ge').replace(/\/$/, '');
const ledgerPath = [path.join(root, 'DEMO-ACCOUNTS.local.md'), '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md'].find(p => fs.existsSync(p));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
// ACCOUNT=wood — დადასტურებული კომპანია SendOfferForm-ისა და შეთავაზების სტატუსებისთვის; PAGES=offers,offer-new — მხოლოდ ეს გვერდები
const accountKey = process.env.ACCOUNT || 'owner_company';
const account = { email: `demo-${accountKey}@meetany.ge`, ...ledger.accounts[accountKey] };
const only = process.env.PAGES ? new Set(process.env.PAGES.split(',')) : null;
const OUT = path.join(root, 'before/company', accountKey === 'owner_company' ? '' : accountKey);
fs.mkdirSync(path.join(OUT, 'text'), { recursive: true });

const MUTATION = /^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|extend_|withdraw_|submit_|complete_|become_|publish_|record_|track_|log_|touch_|upsert_|add_|remove_|toggle_|bind_|request_company_plan|cancel_|accept_|reject_|rate_|review_|report_|block_|unblock_|admin_)/;
const report = { origin: ORIGIN, account: account.email, startedAt: new Date().toISOString(), blocked: [], rpcs: new Set(), pages: [] };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ka-GE' });
await context.route('**/*', route => {
  const req = route.request();
  const url = new URL(req.url());
  if (url.origin === ORIGIN && url.pathname.startsWith('/api/')) {
    const rpc = url.pathname.match(/\/api\/db\/rpc\/([^/?]+)/)?.[1];
    if (rpc) { report.rpcs.add(rpc); if (MUTATION.test(rpc)) { report.blocked.push(rpc); return route.fulfill({ status: 403, body: '{"message":"qa read-only"}', contentType: 'application/json' }); } }
    else if (req.method() !== 'GET' && !url.pathname.startsWith('/api/db/rpc/')) { report.blocked.push(req.method() + ' ' + url.pathname); return route.fulfill({ status: 403, body: '{}' }); }
  }
  return route.continue();
});
const page = await context.newPage();
let bucket = [];
page.on('pageerror', e => bucket.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') bucket.push({ type: 'console', text: m.text().slice(0, 300) }); });
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/_next/')) bucket.push({ type: 'http', text: `${r.status()} ${r.url().slice(0, 160)}` }); });

const settle = async () => { await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900); };

async function audit(name, url, { prep } = {}) {
  if (only && !only.has(name)) return;
  for (const width of [1440, 390]) {
    bucket = [];
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle();
    if (prep) { await prep(page, width).catch(e => bucket.push({ type: 'prep', text: e.message })); await settle(); }
    const info = await page.evaluate(() => {
      const vw = innerWidth;
      const offenders = [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (!r.width || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
        let p = el.parentElement; while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false; p = p.parentElement; }
        return r.right > vw + 1 || r.left < -1;
      }).slice(0, 8).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}] "${(el.innerText || '').trim().slice(0, 40)}"`);
      const clipped = [...document.querySelectorAll('main button, main a, main h1, main h2, main h3, main label, main .ma-chip, main [class*="badge"]')].filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible').slice(0, 8).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.innerText.trim().slice(0, 50)}"`);
      const main = document.querySelector('main') || document.body;
      return { url: location.pathname + location.search, h1: document.querySelector('h1')?.innerText || '', docOverflow: document.documentElement.scrollWidth - vw, offenders, clipped, text: main.innerText, fixedBottom: [...document.querySelectorAll('*')].filter(el => { const cs = getComputedStyle(el); return (cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().bottom >= innerHeight - 2 && el.getBoundingClientRect().height > 30; }).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)}"`) };
    });
    const shot = `${name}-${width}.png`;
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
    fs.writeFileSync(path.join(OUT, 'text', `${name}-${width}.txt`), info.text);
    delete info.text;
    report.pages.push({ name, width, requested: url, ...info, errors: bucket, shot });
    console.log(`${name}@${width} overflow=${info.docOverflow} errors=${bucket.length} h1="${info.h1}" -> ${info.url}`);
  }
}

// შესვლა UI ფორმით
await page.goto(ORIGIN + '/account/', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email]').first().waitFor({ timeout: 30000 });
await page.locator('input[type=email]').first().fill(account.email);
await page.locator('input[type=password]').first().fill(account.password);
await page.locator('form.auth-controls button[type=submit]').first().click();
await page.waitForFunction(() => !document.querySelector('form.auth-controls input[type=password]'), null, { timeout: 30000 });
await settle();

// ღია მოთხოვნა, რომელზეც კომპანიას შეუძლია შეთავაზება
const requestId = process.env.REQUEST_ID || await (async () => {
  await page.goto(ORIGIN + '/matching/', { waitUntil: 'domcontentloaded' }); await settle();
  let href = await page.locator('a[href*="/offers/new"]').first().getAttribute('href').catch(() => null);
  if (href) return new URL(href, ORIGIN).searchParams.get('requestId');
  await page.goto(ORIGIN + '/requests/', { waitUntil: 'domcontentloaded' }); await settle();
  href = await page.locator('a[href*="/requests/view"]').first().getAttribute('href');
  return new URL(href, ORIGIN).searchParams.get('id');
})();
report.requestId = requestId;

await audit('dashboard', '/account/');
await audit('offers', '/account/?tab=offers');
await audit('opportunities', '/account/?tab=opportunities');
await audit('deals', '/account/?tab=deals');
await audit('saved', '/account/?tab=saved');
await audit('messages', '/account/?tab=messages');
await audit('notifications', '/account/?tab=notifications');
await audit('buy-space', '/account/?tab=requests&space=buy');
for (const s of ['details', 'products', 'distribution', 'security']) await audit('profile-' + s, `/account/?tab=profile&section=${s}`);
await audit('business', '/account/?tab=business');
await audit('matching', '/matching/');
// ცარიელ საბმითზე ვალიდაცია: ღილაკზე დაჭერა — გაგზავნის RPC ზემოთ იბლოკება, ფორმის ვალიდაცია კლიენტზე ხდება
await audit('offer-new', `/offers/new/?requestId=${requestId}`);
await audit('offer-new-validation', `/offers/new/?requestId=${requestId}`, { prep: async p => { const b = p.locator('main form button[type=submit]').last(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(800); } });
await audit('request-view', `/requests/view/?id=${requestId}`);
await audit('onboarding', '/onboarding/');
// 7 ნაბიჯი პირდაპირი ბმულით — „შემდეგი“ არ იჭირება, ამიტომ არაფერი ინახება
for (const step of ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']) await audit('onboarding-' + step, `/onboarding/?step=${step}`);
await audit('own-public', `/companies/view/?id=${account.id}`);

report.rpcs = [...report.rpcs].sort();
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, only && accountKey === 'owner_company' ? 'report-partial.json' : 'report.json'), JSON.stringify(report, null, 2));
console.log('blocked:', report.blocked.join(', ') || 'none');
await browser.close();
