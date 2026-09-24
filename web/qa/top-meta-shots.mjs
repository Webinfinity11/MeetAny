// P11 T11.9d: /requests/ with "ტოპ" moved into the meta line; also watches the Next dev overlay (2026-09-24).
// Run: QA_ORIGIN=http://localhost:3001 node qa/top-meta-shots.mjs
// Images are not forced to loading="eager": touching the DOM before hydration is what produced the dev overlay's
// "1 Issue" (hydration mismatch on <img loading>). Lazy images load by scrolling instead.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(root, 'qa/shots/ideal-0924');
const b = await chromium.launch({ headless: true, executablePath });
const info = {};
const overlay = p => p.evaluate(() => { const r = document.querySelector('nextjs-portal')?.shadowRoot; if (!r) return ''; const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); const o = []; let n; while ((n = w.nextNode())) { if (n.parentElement?.closest('style,script')) continue; const t = n.textContent.trim(); if (t) o.push(t); } return o.join(' '); });
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  for (const route of ['/requests/', '/companies/', '/account/']) {
    await p.goto(base + route, { waitUntil: 'load' });
    await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]'), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    if (route === '/requests/') {
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); await document.fonts.ready; await Promise.all([...document.querySelectorAll('main img')].map(i => i.decode().catch(() => {}))); });
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${out}/requests-${w}.png`, fullPage: true });
      info[`list${w}`] = await p.evaluate(() => [...document.querySelectorAll('main article.request-card')].slice(0, 8).map(r => {
        const m = r.querySelector('.request-card-meta'), t = r.querySelector('h2'), cs = getComputedStyle(m);
        const above = [...r.querySelectorAll('.request-card-content > *')].filter(e => e.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1).map(e => e.className);
        return { tier: r.className.match(/request-card--(vip|top)/)?.[1] || null, meta: m.innerText.slice(0, 80), metaFont: `${cs.fontSize}/${cs.lineHeight}`, metaColor: cs.color, aboveTitle: above };
      }));
    }
    info[`overlay${w}${route}`] = await overlay(p);
  }
  info[`console${w}`] = logs;
  await ctx.close();
}
fs.writeFileSync(`${out}/top-meta-qa.json`, JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
await b.close();
