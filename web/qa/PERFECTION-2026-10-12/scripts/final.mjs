// საბოლოო გავლა: დამატებითი კადრები ინტეგრირებულ კოდზე — გარიგება 360/390/1440 (მყიდველი და მომწოდებელი),
// მფლობელის მოთხოვნა არჩეული შეთავაზებით, onboarding-ის შეჯამება. მხოლოდ წაკითხვა: ჩაწერის RPC-ები ბრაუზერში იბლოკება.
// გაშვება web/-დან: BASE=http://localhost:3309 node qa/PERFECTION-2026-10-12/scripts/final.mjs
// სესიები: deal-after.mjs-ის storageState (/tmp/deal-thread/auth-*.json), გარიგება/მოთხოვნა — /tmp/deal-thread/qa-state.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE || 'http://localhost:3309';
const out = path.resolve(import.meta.dirname, '../after/final');
fs.mkdirSync(out, { recursive: true });
const state = JSON.parse(fs.readFileSync('/tmp/deal-thread/qa-state.json', 'utf8'));
const WRITE = /\/api\/db\/rpc\/(create_|update_|delete_|send_|start_|mark_|set_|save_|select_|close_|submit_|complete_|cancel_|review_|advance_|propose_|confirm_|rate_|open_|add_|log_|track_|record_)/;
const report = { base, at: new Date().toISOString(), state, pages: [], blocked: [] };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

async function visit(role, name, url, width) {
  const height = width === 360 ? 780 : width === 390 ? 844 : 1000;
  const ctx = await browser.newContext({ storageState: `/tmp/deal-thread/auth-${role}.json`, viewport: { width, height }, isMobile: width < 640, hasTouch: width < 640, locale: 'ka-GE', reducedMotion: 'reduce' });
  await ctx.route('**/*', route => { if (WRITE.test(route.request().url())) { report.blocked.push(route.request().url().split('/rpc/')[1]); return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"qa read-only"}' }); } return route.continue(); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('qa read-only') && !m.text().includes('403')) errors.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errors.push('pageerror ' + e.message.slice(0, 200)));
  await p.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => { const m = document.querySelector('main'); return m && m.innerText.length > 20 && !m.innerText.includes('იტვირთება'); }, null, { timeout: 20000 }).catch(() => {});
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const file = `${name}-${role}-${width}.png`;
  await p.screenshot({ path: path.join(out, file), fullPage: true });
  report.pages.push({ file, url, console: errors, overflow });
  console.log(file, 'console', errors.length, 'overflow', overflow);
  await ctx.close();
}

for (const width of [1440, 390, 360]) {
  await visit('buyer', 'deal', `/deals/view/?id=${state.dealId}`, width);
  await visit('supplier', 'deal', `/deals/view/?id=${state.dealId}`, width);
  await visit('buyer', 'request-owner-chosen', `/requests/view/?id=${state.requestId}`, width);
  await visit('buyer', 'account', '/account/', width);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
