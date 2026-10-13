// The home live strip (HomeBusinessScene): screenshots with motion on, and the pause behaviour.
// Run from web/:  node qa/home-v2-2026-10-13/carousel.mjs --origin http://127.0.0.1:3320 [--prefix carousel]
// Checks: hover pauses and leaving resumes (desktop); keyboard focus pauses; the pause button is invisible
// to a mouse, visible on keyboard focus and on touch; prefers-reduced-motion stops the animation.
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin').replace(/\/+$/, ''), prefix = arg('prefix', 'carousel'), dir = 'qa/home-v2-2026-10-13';
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const offset = page => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.hero-scene__track')).transform).m42);
const moved = async page => { const a = await offset(page); await page.waitForTimeout(700); return Math.abs(await offset(page) - a) > 0.5; };

async function open(width, height, options = {}) {
  const mobile = width < 768;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2, ...options });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  const scene = page.locator('.hero-scene');
  await scene.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -120));
  await page.waitForTimeout(400);
  return { context, page, scene, errors };
}

{ // Desktop: motion, hover, focus, button.
  const { context, page, scene, errors } = await open(1440, 900);
  await page.mouse.move(5, 5);
  check('1440 runs without interaction', await moved(page));
  await page.locator('section:has(#live-title)').screenshot({ path: `${dir}/${prefix}-1440.png` });
  check('1440 pause button hidden for the mouse', await page.locator('.hero-scene__motion').evaluate(b => getComputedStyle(b).opacity === '0'));
  check('1440 headings removed', await page.locator('.home-live-headings').count() === 0);
  // The cards never stand still, so move the real mouse onto the strip instead of locator.hover().
  { const b = await scene.boundingBox(); await page.mouse.move(b.x + b.width * .25, b.y + b.height * .45); }
  await page.waitForTimeout(300);
  check('1440 hover pauses', !(await moved(page)));
  await page.locator('section:has(#live-title)').screenshot({ path: `${dir}/${prefix}-1440-hover.png` });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
  check('1440 leaving resumes', await moved(page));
  await page.locator('.hero-scene a:not([tabindex="-1"])').first().focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await page.mouse.move(5, 5);
  check('1440 keyboard focus pauses', !(await moved(page)));
  await page.locator('.hero-scene__motion').focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  check('1440 pause button visible on keyboard focus', await page.locator('.hero-scene__motion').evaluate(b => getComputedStyle(b).opacity === '1' && b === document.activeElement));
  check('1440 console errors 0', errors.length === 0, errors.join(' | '));
  await context.close();
}
{ // Phone: motion, button on touch, tap pauses.
  const { context, page, errors } = await open(390, 844);
  check('390 runs', await moved(page));
  await page.locator('section:has(#live-title)').screenshot({ path: `${dir}/${prefix}-390.png` });
  const button = page.locator('.hero-scene__motion');
  check('390 pause button visible on touch', await button.evaluate(b => getComputedStyle(b).opacity === '1'));
  const box = await button.boundingBox();
  check('390 pause target ≥44px', box.width >= 44 && box.height >= 44, `${box.width}×${box.height}`);
  await button.tap();
  await page.waitForTimeout(200);
  check('390 button pauses', !(await moved(page)));
  await button.tap();
  await page.waitForTimeout(200);
  check('390 button resumes', await moved(page));
  check('390 overflow 0', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) === 0);
  check('390 console errors 0', errors.length === 0, errors.join(' | '));
  await context.close();
}
{ // Reduced motion: no animation, no button.
  const { context, page } = await open(1440, 900, { reducedMotion: 'reduce' });
  check('reduced motion: static', await page.evaluate(() => getComputedStyle(document.querySelector('.hero-scene__track')).animationName === 'none'));
  check('reduced motion: no button', await page.locator('.hero-scene__motion').evaluate(b => getComputedStyle(b).display === 'none'));
  await context.close();
}
await browser.close();
process.exitCode = results.every(Boolean) ? 0 : 1;
