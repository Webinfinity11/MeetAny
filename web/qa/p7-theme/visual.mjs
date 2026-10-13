import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.QA_ORIGIN || 'http://localhost:3704';
const output = new URL('./shots/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { views: [], pageErrors: [] };
try {
  for (const width of [1440, 390, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    for (const [name, route] of [['home', '/'], ['requests', '/requests/'], ['account', '/account/']]) {
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
      const toggle = page.locator('footer .ma-theme-toggle');
      await toggle.waitFor();
      await page.waitForFunction(() => { const button = document.querySelector('footer .ma-theme-toggle'); return Object.keys(button || {}).some(key => key.startsWith('__reactProps') && typeof button[key]?.onClick === 'function'); });
      assert.equal(await page.locator('header .ma-theme-toggle').count(), 0);
      for (const theme of ['blue', 'classic']) {
        if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) await toggle.click();
        await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
        await toggle.scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        const state = await toggle.evaluate(button => {
          const rect = button.getBoundingClientRect();
          return { label: button.textContent, height: rect.height, color: getComputedStyle(button).color, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
        });
        assert.equal(state.label, theme === 'blue' ? 'თემა: ლურჯი' : 'თემა: შავ-თეთრი');
        assert.equal(state.overflow, 0);
        assert.ok(state.height >= 44);
        await page.mouse.move(0, 0);
        const footerShot = `${name}-${theme}-${width}-footer.png`;
        await page.screenshot({ path: fileURLToPath(new URL(footerShot, output)) });
        await page.evaluate(() => scrollTo(0, 0));
        const header = await page.locator('header').first().evaluate(element => {
          const boxes = [...element.querySelectorAll('a,button')].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
          return { outside: boxes.filter(r => r.left < 0 || r.right > innerWidth).length, rows: [...new Set(boxes.map(r => Math.round(r.top + r.height / 2)))] };
        });
        assert.equal(header.outside, 0);
        assert.ok(Math.max(...header.rows) - Math.min(...header.rows) <= 2, 'Header controls share one row');
        const headerShot = `${name}-${theme}-${width}-header.png`;
        await page.screenshot({ path: fileURLToPath(new URL(headerShot, output)) });
        report.views.push({ route, theme, width, ...state, header, footerShot, headerShot });
      }
    }
    await context.close();
  }
  assert.equal(report.pageErrors.length, 0);
  console.log(`PASS: ${report.views.length} views; overflow 0; pageerror 0; headers one row; toggle >=44px`);
} finally {
  await fs.writeFile(new URL('./visual-report.json', import.meta.url), JSON.stringify(report, null, 2));
  await browser.close();
}
