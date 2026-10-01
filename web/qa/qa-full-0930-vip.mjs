// VIP/Premium visual check with a mocked company_business_features response (no DB writes).
import { chromium } from 'playwright';
const OUT = 'qa/shots/qa-full-0930'; const O = 'http://localhost:3001';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const out = [];
for (const [vk, vp] of [['d', { width: 1440, height: 1000 }], ['m', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
  await page.route('**/api/db/rpc/company_business_features', async route => {
    const r = await route.fetch(); const j = await r.json();
    j.forEach((c, i) => { if (i === 0) Object.assign(c, { plan: 'vip', rating: 4.8, reviewCount: 12, distributor: true }); if (i === 1) Object.assign(c, { plan: 'premium', rating: 4.5, reviewCount: 3 }); if (i === 4) Object.assign(c, { plan: 'vip' }); if (i === 5) Object.assign(c, { distributor: true, rating: 4.2, reviewCount: 2 }); });
    await route.fulfill({ response: r, json: j });
  });
  for (const [n, u] of [['home', '/'], ['companies', '/companies/'], ['company-vip', '/companies/view/?id=3d12ff1f-0d72-4a53-a92f-1830cfd5b290'], ['request-detail', '/requests/view/?id=fe713e7f-9ac8-40b1-95a7-c9231316d9ca']]) {
    await page.goto(O + u, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    if (n === 'home') await page.locator('#featured-companies').scrollIntoViewIfNeeded().catch(() => {});
    const c = await page.evaluate(() => ({ vip: document.querySelectorAll('[data-plan="vip"]').length, prem: document.querySelectorAll('[data-plan="premium"]').length, order: [...document.querySelectorAll('[data-plan]')].map(e => e.dataset.plan).join(',') }));
    await page.screenshot({ path: `${OUT}/vipmock-${vk}-${n}.png` }); out.push({ vk, n, ...c }); console.log(vk, n, JSON.stringify(c));
  }
  await ctx.close();
}
await browser.close();
