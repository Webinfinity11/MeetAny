import assert from 'node:assert/strict';
import { masks } from '../pages.mjs';
export const readRPCs = new Set(['company_products', 'company_distribution_profiles', 'company_business_features', 'company_reviews', 'my_company_review_targets', 'my_business_settings', 'admin_market_metrics', 'admin_list_reports', 'admin_business_queue', 'admin_search_offers', 'admin_list_audit_v2', 'my_profile', 'list_companies', 'company_stats', 'offer_counts', 'contact_for_request', 'list_my_conversations', 'list_messages', 'unread_message_count', 'engagement_state', 'list_notifications', 'list_saved_companies', 'request_alert_preferences', 'admin_stats', 'admin_list_users', 'admin_search_users', 'admin_search_requests', 'admin_list_audit', 'admin_contact_events', 'admin_contact_stats', 'admin_message_stats', 'admin_list_conversations', 'admin_conversation_messages', 'mark_read']);
export async function guard(context, state) {
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
    const rpc = url.pathname.match(/^\/api\/db\/rpc\/([^/]+)$/)?.[1];
    if (rpc === 'start_conversation' && state.chat) {
      state.interceptions++;
      return route.fulfill({ json: state.chat });
    }
    if (rpc && readRPCs.has(rpc)) return route.continue();
    if (/^\/api\/auth\//.test(url.pathname) && /\/(sign-in|session|get-session|token)/.test(url.pathname)) return route.continue();
    state.blocked.push(`${request.method()} ${url.pathname}`);
    await route.abort('blockedbyclient');
  });
}
export async function go(page, origin, route) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (error) { if (attempt) { error.navigationRetried = true; throw error; } console.log(`ნელი გვერდის გამეორება: ${route.split('?')[0]}`); }
  }
  await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 60000 });
}
export async function ready(page) {
  // Mobile conversation portals live outside main; wait for their messages, too.
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"], .inbox-log[aria-busy="true"], .inbox-log__note[role="status"], .ma-chat [role="status"]'), null, { timeout: 60000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}nextjs-portal,[data-nextjs-toast]{display:none!important}' });
  assert(!await page.locator('h2[role="alert"]').count(), 'სერვისი მიუწვდომელია; შეცდომის ეკრანი baseline არ არის');
  await page.evaluate(() => document.fonts.ready);
  // Scroll to request native lazy images, without mutating React-owned loading attributes.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 80));
    }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await page.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 60000 });
  await page.evaluate(() => {
    // Safety net for phone numbers embedded in legacy text or message bodies.
    const phone = /(?:\+?995[\s()-]*)?5\d{2}[\s()-]*\d{2,3}[\s()-]*\d{2,3}[\s()-]*\d{0,2}/;
    for (const el of document.querySelectorAll('body *:not(script):not(style)')) {
      if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && phone.test(n.textContent || '')) || (el.matches('input') && phone.test(el.value || ''))) el.setAttribute('data-visual-private', '');
    }
  });
  await page.waitForTimeout(250);
}
// Screenshot masks otherwise paint through dialogs and hide their controls.
// Keep only the exposed pieces of each selected rectangle, without changing layout.
export async function maskRectangles(page) {
  await page.locator('[data-visual-mask-rect]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
  for (const selector of masks) {
    await page.locator(selector).evaluateAll(elements => {
      const overlays = [...document.querySelectorAll('dialog[open], .inbox-thread--sheet')];
      for (const element of elements) {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none') continue;
        let rects = [{ left: box.left, top: box.top, right: box.right, bottom: box.bottom }];
        for (const overlay of overlays) {
          if (overlay.contains(element)) continue;
          // The mobile ChatPopup backdrop is opaque over the entire document.
          if (overlay.matches('.ma-chat:modal')) { rects = []; break; }
          const cover = overlay.getBoundingClientRect();
          rects = rects.flatMap(rect => {
            const left = Math.max(rect.left, cover.left), top = Math.max(rect.top, cover.top);
            const right = Math.min(rect.right, cover.right), bottom = Math.min(rect.bottom, cover.bottom);
            if (left >= right || top >= bottom) return [rect];
            return [
              { ...rect, bottom: top }, { ...rect, top: bottom },
              { left: rect.left, top, right: left, bottom },
              { left: right, top, right: rect.right, bottom },
            ].filter(r => r.right > r.left && r.bottom > r.top);
          });
        }
        for (const rect of rects) {
          const marker = document.createElement('div');
          marker.setAttribute('data-visual-mask-rect', '');
          marker.style.cssText = `position:absolute;left:${rect.left + scrollX}px;top:${rect.top + scrollY}px;width:${rect.right - rect.left}px;height:${rect.bottom - rect.top}px;margin:0;padding:0;border:0;opacity:0;pointer-events:none;`;
          document.body.append(marker);
        }
      }
    });
  }
  return page.locator('[data-visual-mask-rect]');
}
export async function shot(page, file, viewport) {
  await ready(page);
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) }));
  assert(size.width <= viewport.width + 1, `ჰორიზონტალური გადაცდენა: ${size.width}px > ${viewport.width}px`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide', mask: [await maskRectangles(page)], maskColor: '#CBD5E1' });
  return size;
}
