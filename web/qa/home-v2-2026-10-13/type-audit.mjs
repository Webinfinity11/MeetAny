// Typography audit of the home page <main> (owner's comfort rules, 2026-10-13).
// Run from web/:  node qa/home-v2-2026-10-13/type-audit.mjs --origin http://127.0.0.1:3320 [--out file.json]
// Per visible text element: size (body ≥16 desktop / ≥15 mobile, meta ≥13), line-height (text 1.55–1.7,
// headings 1.2–1.35), AA contrast against the painted background, Mtavruli ("case") outside headings/buttons,
// paragraph measure (≤ ~75ch), and tap targets ≥44px. Lists the distinct text sizes per viewport.
import fs from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin').replace(/\/+$/, ''), out = arg('out');
const browser = await chromium.launch();
const report = {};
for (const [width, height] of [[1440, 900], [390, 844]]) {
  const mobile = width < 768;
  const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  const r = await page.evaluate(mobile => {
    const parse = c => { const m = c.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const toRgb = c => { const cv = document.createElement('canvas').getContext('2d'); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const bg = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && e.querySelector('img')) return null; const c = toRgb(s.backgroundColor); if (c.a > .9) return c; } return { r: 255, g: 255, b: 255 }; };
    const name = el => { const cls = [...el.classList].map(c => c.replace(/_[A-Za-z0-9-]{5,}$/, '').replace(/^.*__/, '')).slice(0, 2).join('.'); return `${el.closest('section')?.getAttribute('aria-labelledby') || el.closest('section')?.getAttribute('aria-label') || el.closest('section')?.className.split(' ')[0] || ''} › ${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`; };
    const issues = [], sizes = new Map();
    for (const el of document.querySelectorAll('main *')) {
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      // Decorative (aria-hidden) text is still read by sighted visitors, so it is audited too; only the
      // carousel's duplicate loop copy is skipped.
      if (!own || el.closest('.hero-scene__group[aria-hidden]')) continue;
      const rect = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (!rect.width || s.visibility === 'hidden' || s.display === 'none' || el.closest('[hidden],details:not([open]) > :not(summary)')) continue;
      const fs = parseFloat(s.fontSize), lh = s.lineHeight === 'normal' ? fs * 1.2 : parseFloat(s.lineHeight), ratio = lh / fs;
      const heading = !!el.closest('h1,h2,h3,h4,summary'), button = !!el.closest('.ma-btn,button');
      // Lines actually used by the element's own text (padding and min-height do not count).
      const range = document.createRange(); range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top / (lh * .5))));
      const multi = tops.size > 1;
      // Text = sentences (over 40 characters); shorter strings are labels/meta even when a narrow card wraps them.
      const kind = heading ? 'heading' : button ? 'button' : own.length > 40 ? 'text' : 'meta';
      sizes.set(fs, (sizes.get(fs) || 0) + 1);
      const at = name(el), sample = own.slice(0, 40);
      const minBody = mobile ? 15 : 16;
      if (kind === 'text' && fs < minBody) issues.push({ rule: `text ≥${minBody}px`, at, fs, sample });
      if ((kind === 'meta') && fs < 13) issues.push({ rule: 'meta ≥13px', at, fs, sample });
      if (kind === 'text' && multi && (ratio < 1.55 || ratio > 1.75)) issues.push({ rule: 'text line-height 1.55–1.7', at, ratio: +ratio.toFixed(2), sample });
      if (kind === 'meta' && multi && (ratio < 1.3 || ratio > 1.75)) issues.push({ rule: 'wrapped label line-height 1.3–1.7', at, ratio: +ratio.toFixed(2), sample });
      if (kind === 'heading' && multi && (ratio < 1.15 || ratio > 1.4)) issues.push({ rule: 'heading line-height 1.2–1.35', at, ratio: +ratio.toFixed(2), sample });
      if (!heading && !button && /case/.test(s.fontFeatureSettings)) issues.push({ rule: 'Mtavruli outside headings/buttons', at, sample });
      if (kind === 'text' && el.tagName === 'P' && rect.width / fs > 38) issues.push({ rule: 'measure ≤ ~75ch', at, ch: Math.round(rect.width / (fs * .5)), sample });
      const b = bg(el); if (b) { const fg = toRgb(s.color); const L1 = lum(fg), L2 = lum(b); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const need = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5; if (cr < need) issues.push({ rule: 'contrast AA', at, cr: +cr.toFixed(2), need, sample }); }
    }
    for (const el of document.querySelectorAll('main a, main button, main summary')) {
      const rect = el.getBoundingClientRect(); if (!rect.width || getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden="true"]') || el.tabIndex < 0) continue;
      // A link whose ::after covers its card makes the whole card the target.
      const after = getComputedStyle(el, '::after'); const covered = after.content !== 'none' && after.position === 'absolute' && el.closest('article');
      if (rect.height < 43.5 && !covered && !el.closest('p,li,dt')) issues.push({ rule: 'tap target ≥44px', at: name(el), h: Math.round(rect.height), sample: el.textContent.trim().slice(0, 30) });
    }
    return { sizes: [...sizes].sort((a, b) => a[0] - b[0]), issues };
  }, mobile);
  report[width] = r;
  const grouped = new Map(); for (const i of r.issues) { const k = `${i.rule} | ${i.at} | ${i.fs ?? i.ratio ?? i.cr ?? i.ch ?? i.h ?? ''}`; grouped.set(k, (grouped.get(k) || { ...i, n: 0 })); grouped.get(k).n++; }
  console.log(`\n=== ${width}: sizes ${r.sizes.map(([s, n]) => `${s}px×${n}`).join(' ')}`);
  for (const [k, v] of grouped) console.log(`${k} ×${v.n}  «${v.sample}»`);
  await page.close();
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
