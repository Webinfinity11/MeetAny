import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const base = process.env.BASE || 'http://localhost:3705';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  const sitemap = await fetch(`${base}/sitemap.xml`).then(r => r.text());
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].replaceAll('&amp;', '&'));
  const paths = ['/', '/requests/', '/companies/', new URL(urls.find(u => u.includes('/requests/view/'))).pathname + new URL(urls.find(u => u.includes('/requests/view/'))).search,
    new URL(urls.find(u => u.includes('/companies/view/'))).pathname + new URL(urls.find(u => u.includes('/companies/view/'))).search];
  for (const width of [1440, 390, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [index, path] of paths.entries()) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      await page.screenshot({ path: `qa/p7-seo/shots/page-${width}-${index}.png`, fullPage: true, caret: "initial" });
      results.push({ width, path, overflow, errors: [...errors] });
      errors.length = 0;
    }
    await page.close();
  }
  await writeFile(new URL('visual.json', import.meta.url), JSON.stringify(results, null, 2));
  console.table(results);
} finally { await browser.close(); }
process.exitCode = results.some(r => r.overflow || r.errors.length) ? 1 : 0;
