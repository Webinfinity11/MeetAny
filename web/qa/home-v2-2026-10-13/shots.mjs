// Guest screenshots of the home page and the checks that go with them (overflow, console errors).
// Run from web/:  node qa/home-v2-2026-10-13/shots.mjs --origin http://127.0.0.1:3320 [--prefix after]
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin').replace(/\/+$/, ''), prefix = arg('prefix', 'after'), dir = 'qa/home-v2-2026-10-13';
const widths = [[1440, 900], [390, 844], [360, 780]];
const browser = await chromium.launch();
let failed = false;
for (const [width, height] of widths) {
  const mobile = width < 768;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  // Scroll through once so lazy images load, then back to the top.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - innerWidth;
    const wide = [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !el.closest('[class*="companies"],.home-opportunities,[class*="Companies"]'); })
      .slice(0, 5).map(el => `${el.tagName}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}`);
    return { doc, wide };
  });
  await page.screenshot({ path: `${dir}/${prefix}-${width}.png`, fullPage: true });
  await page.screenshot({ path: `${dir}/${prefix}-${width}-fold.png` });
  console.log(`${width}: overflow ${overflow.doc}${overflow.wide.length ? ' ' + overflow.wide.join(', ') : ''} · console errors ${errors.length}${errors.length ? ': ' + errors.join(' | ') : ''}`);
  if (overflow.doc > 0 || errors.length) failed = true;
  await context.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
