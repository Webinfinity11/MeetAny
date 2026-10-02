import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { categoryGroups } from '../app/lib/categories-data.js';

const origin = process.env.QA_ORIGIN || 'http://localhost:3004';
const categories = categoryGroups.flatMap(group => group.items.map(([key, label]) => ({ key, label })));
const source = JSON.parse(fs.readFileSync(new URL('../public/icons-categories.SOURCES.json', import.meta.url)));
for (const { key } of categories) assert(source.mapping[key], `Missing category mapping: ${key}`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Inspect the real local sprite independently from authentication or catalogue data.
  const cells = categories.map(({ key, label }) => `<div class="cell"><div class="tile"><svg data-category="${key}" viewBox="0 0 960 960"><use href="/icons-categories.svg#${key}"/></svg></div><span>${label}</span></div>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:14px Arial;padding:32px;color:#15304a}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:30px 20px}.cell{text-align:center;line-height:1.5}.tile{width:48px;height:48px;border-radius:50%;background:#edf3ff;color:#2457c7;display:grid;place-items:center;margin:0 auto 10px}.tile svg{width:28px;height:28px;fill:currentColor}</style><h1>MeetAny · Rounded category icons</h1><div class="grid">${cells}</div>`;
  await page.route(`${origin}/__qa-category-icons`, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${origin}/__qa-category-icons`, { waitUntil: 'networkidle' });
  const glyphs = [];
  for (const { key } of categories) {
    const pixels = PNG.sync.read(await page.locator(`[data-category="${key}"]`).screenshot());
    let ink = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      const [red, green, blue] = pixels.data.subarray(index, index + 3);
      if (red < 130 && green < 170 && blue > 140) ink++;
    }
    assert(ink > 12, `Invisible or clipped glyph: ${key} (${ink} pixels)`);
    glyphs.push({ key, ink });
  }
  await page.screenshot({ path: process.env.QA_ICON_SHOT || '/tmp/meetany-category-icons.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, family: source.family, categories: categories.length, glyphs }));
} finally {
  await browser.close();
}
