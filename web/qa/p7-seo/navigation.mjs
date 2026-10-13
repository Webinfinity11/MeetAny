import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const kind of ['requests', 'companies']) {
    await page.goto(`${process.env.BASE || 'http://localhost:3705'}/${kind}/`, { waitUntil: 'networkidle' });
    const link = page.locator(`a[href^="/${kind}/view/?id="]`).first();
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForURL(url => url.pathname === `/${kind}/view/`);
    await page.locator('main h1').waitFor();
    results.push({ kind, href, url: page.url(), errors: [...errors] });
  }
  await writeFile(new URL('navigation.json', import.meta.url), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
