// კონკურენტების ცოცხალი გვერდების სქრინშოტები (მხოლოდ კვლევა, აპის კოდს არ ეხება).
// გაშვება: node qa/competitors.mjs [საიტის-ფილტრი]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, 'ref-competitors');
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2];

// pick: ფუნქცია, რომელიც სიის გვერდზე პოულობს პირველი დეტალური გვერდის ბმულს
const digitsLink = src => src;
const sites = [
  { site: 'ss', pages: [
    { name: 'list', url: 'https://ss.ge/ka/udzravi-qoneba/l/bina/iyideba?cityIdList=95&currencyId=1', full: true },
    { name: 'item', from: 'list', pick: digitsLink('^/ka/udzravi-qoneba/[^/]*-\\d{5,}$') } ] },
  { site: 'myhome', pages: [
    { name: 'list', url: 'https://www.myhome.ge/ka/s/iyideba-bina-tbilisshi', full: true },
    { name: 'item', from: 'list', pick: digitsLink(/\/ka\/pr\/\d+/) } ] },
  { site: 'biznesebi', pages: [
    { name: 'list', url: 'https://biznesebi.ge/', full: true },
    { name: 'company', from: 'list', pick: digitsLink(/biznesebi\.ge\/ka\/[^/]+\/?$|\/company\/|\/kompania\//) } ] },
  { site: 'jobs', pages: [{ name: 'list', url: 'https://jobs.ge/ka/', full: true }] },
  { site: 'mymarket', pages: [
    { name: 'list', url: 'https://www.mymarket.ge/ka/search/?CatID=693', full: true },
    { name: 'item', from: 'list', pick: digitsLink(/\/ka\/pr\/\d+/) } ] },
  { site: 'europages', pages: [
    { name: 'list', url: 'https://www.europages.co.uk/companies/furniture.html', full: true },
    { name: 'profile', from: 'list', pick: digitsLink('^/en/company/[^/]+-\\d+$') } ] },
  { site: 'kompass', pages: [
    { name: 'list', url: 'https://us.kompass.com/a/furniture/', full: true },
    { name: 'company', from: 'list', pick: digitsLink(/\/c\/[^/]+\/[a-z]{2}\d+\//) } ] },
  { site: 'alibaba', pages: [
    { name: 'rfq', url: 'https://sourcing.alibaba.com/rfq/rfq_search_list.htm?country=AE&recently=Y', full: true } ] },
  { site: 'thumbtack', pages: [
    { name: 'list', url: 'https://www.thumbtack.com/k/house-cleaning/near-me/', full: true },
    { name: 'pro', from: 'list', pick: digitsLink('/service/\\d+') } ] },
  { site: 'houzz', pages: [
    { name: 'pros', url: 'https://www.houzz.com/professionals/interior-designers', full: true } ] },
  { site: 'upwork', pages: [
    { name: 'jobs', url: 'https://www.upwork.com/nx/search/jobs/?q=web%20design', full: true } ] },
  { site: 'linear', pages: [
    { name: 'home', url: 'https://linear.app/' },
    { name: 'inner', url: 'https://linear.app/customers', full: true } ] },
  { site: 'stripe', pages: [
    { name: 'home', url: 'https://stripe.com/' },
    { name: 'inner', url: 'https://stripe.com/payments', full: true } ] },
];

const hide = () => {
  const sel = ['[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]',
    '[id*="onetrust" i]', '[class*="gdpr" i]', '[id*="cmp" i][role="dialog"]', '[aria-label*="cookie" i]'];
  document.querySelectorAll(sel.join(',')).forEach(e => { e.style.setProperty('display', 'none', 'important'); });
  for (const b of document.querySelectorAll('button')) {
    if (/^(accept|agree|allow all|got it|ok|თანხმობა|თანახმა|დიახ|მივიღე|accept all)/i.test(b.innerText.trim())) { try { b.click(); } catch {} }
  }
  document.body && (document.body.style.overflow = 'auto');
};

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const log = [];
for (const s of sites) {
  if (only && s.site !== only) continue;
  const urls = {};
  for (const p of s.pages) {
    for (const w of [1440, 390]) {
      const h = w === 1440 ? 1000 : 844;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ka-GE', isMobile: w === 390, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const tag = `${s.site}-${p.name}-${w}`;
      try {
        let url = p.url;
        if (p.from) {
          url = urls[p.from + w];
          if (!url) throw new Error('დეტალური ბმული ვერ მოიძებნა');
        }
        await page.goto(url, { timeout: 30000, waitUntil: 'commit' });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        if (s.site !== 'europages') { await page.evaluate(hide).catch(() => {}); await page.waitForTimeout(500); await page.evaluate(hide).catch(() => {}); }
        if (s.site === 'stripe') { await page.keyboard.press('Escape'); await page.waitForTimeout(800); }
        if (s.site === 'europages') { await page.evaluate(() => document.querySelectorAll('#onetrust-consent-sdk,#didomi-host,[id*="cookie" i][role="dialog"]').forEach(e => e.remove())); await page.waitForTimeout(1500); }
        const title = await page.title();
        const body = (await page.evaluate(() => document.body.innerText.slice(0, 400))).replace(/\s+/g, ' ');
        if (/access denied|captcha|just a moment|verify you are human|robot/i.test(title + ' ' + body)) throw new Error('დაბლოკილია: ' + title);
        if (!p.pick || true) urls[p.name + w] = page.url();
        // შემდეგი გვერდისთვის ბმული
        const next = s.pages.find(x => x.from === p.name);
        if (next) urls[next.from + w + '_pick'] = await page.evaluate(src => { const re = new RegExp(src); const a = [...document.querySelectorAll('a[href]')].find(x => re.test(x.getAttribute('href'))); return a ? a.href : null; }, next.pick).catch(() => null);
        await page.screenshot({ path: path.join(out, `${tag}.png`) });
        if (p.full) {
          const hh = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 6000));
          await page.screenshot({ path: path.join(out, `${tag}-full.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: hh } });
        }
        log.push(`OK ${tag} ${page.url()}`);
        // detail url ჩაანაცვლოს
        if (next) urls[p.name + w] = urls[next.from + w + '_pick'] || null;
      } catch (e) {
        log.push(`SKIP ${tag}: ${String(e.message).split('\n')[0]}`);
        const next = s.pages.find(x => x.from === p.name);
        if (next) urls[p.name + w] = null;
      }
      await ctx.close();
    }
  }
}
await browser.close();
fs.appendFileSync(path.join(out, 'log.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
