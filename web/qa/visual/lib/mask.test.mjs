import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { maskRectangles } from './browser.mjs';

test('masks cover exposed time metadata but do not paint through a conversation or modal', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<style>body{margin:0;background:white}.request-card-meta{position:absolute;left:20px;top:100px;width:200px;height:50px;background:green}.inbox-thread--sheet{position:fixed;left:100px;top:90px;width:180px;height:200px;background:white}</style><div class="request-card-meta">dynamic time</div><div class="inbox-thread--sheet">conversation</div>`);
    const png = PNG.sync.read(await page.screenshot({ mask: [await maskRectangles(page)], maskColor: '#CBD5E1' }));
    const rgb = (x, y) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
    assert.deepEqual(rgb(50, 110), [203, 213, 225], 'exposed metadata is masked');
    assert.deepEqual(rgb(150, 110), [255, 255, 255], 'foreground conversation is not masked by background metadata');
    await page.setContent('<div class="request-card-meta">background</div><dialog class="ma-chat"><time>12:30</time></dialog>');
    await page.locator('dialog').evaluate(dialog => dialog.showModal());
    assert.equal(await (await maskRectangles(page)).count(), 1, 'opaque modal excludes background masks, but retains its own time mask');
  } finally { await browser.close(); }
});
