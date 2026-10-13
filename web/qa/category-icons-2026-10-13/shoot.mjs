// Category icon QA shots: node qa/category-icons-2026-10-13/shoot.mjs <before|after> [origin]
// Sidebar (1440) with an inactive list and an active group, the mobile filter sheet (390), and a
// request card without a photo (the category illustration).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const tag = process.argv[2] || 'after';
const origin = process.argv[3] || 'http://localhost:3117';
const dir = fileURLToPath(new URL('.', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const shot = name => `${dir}${tag}-${name}.png`;

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  for (const [path, name] of [['/requests/', 'requests'], ['/companies/', 'companies']]) {
    await desktop.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    await desktop.locator('.catalog-sidebar').first().screenshot({ path: shot(`${name}-1440-sidebar`) });
    const row = desktop.locator('.catalog-sidebar button[aria-pressed]').filter({ hasText: 'მშენებლობა და რემონტი' }).first();
    await row.click();
    await desktop.waitForTimeout(600);
    await desktop.locator('.catalog-sidebar').first().screenshot({ path: shot(`${name}-1440-sidebar-active`) });
    await desktop.screenshot({ path: shot(`${name}-1440-page`) });
  }
  // Request cards that fall back to the category illustration.
  await desktop.goto(`${origin}/requests/`, { waitUntil: 'networkidle' });
  const cover = desktop.locator('[class*="RequestCatalogCover"], [class*="cover"]').first();
  if (await cover.count()) await cover.locator('xpath=ancestor::*[self::article or self::li or self::a][1]').first().screenshot({ path: shot('requests-1440-card-nophoto') });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const [path, name] of [['/requests/', 'requests'], ['/companies/', 'companies']]) {
    await mobile.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    await mobile.locator('.catalog-filter-toggle').first().click();
    await mobile.waitForTimeout(700);
    await mobile.screenshot({ path: shot(`${name}-390-sheet`) });
    const chip = mobile.locator('[role="dialog"] button[aria-pressed]').filter({ hasText: 'მშენებლობა და რემონტი' }).first();
    if (await chip.count()) { await chip.click(); await mobile.waitForTimeout(500); await mobile.screenshot({ path: shot(`${name}-390-sheet-active`) }); }
  }
} finally {
  await browser.close();
}
console.log('shots in', dir);
