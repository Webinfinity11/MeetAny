// Run the existing audit with hydration readiness and a reusable single-login session.
import { chromium } from 'playwright';
import fs from 'node:fs';
const sessionPath = '/tmp/p7-theme-owner_company.json';
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options = {}) => {
    const saved = fs.existsSync(sessionPath);
    const context = await newContext({ ...options, ...(saved ? { storageState: sessionPath } : {}) });
    let first = true;
    context.on('page', page => {
      const isLogin = first;
      first = false;
      page.on('response', response => {
        if (response.status() === 429) console.error('AUTH_RATE_LIMIT: stop and back off before retrying');
      });
      const query = page.$.bind(page);
      page.$ = selector => query(selector.replace('aria-label="შეტყობინებები"', 'aria-label^="შეტყობინებები"'));
      const goto = page.goto.bind(page);
      page.goto = async (...gotoArgs) => {
        const response = await goto(...gotoArgs);
        await page.locator(isLogin && !saved ? '#login-email' : 'header button[aria-label="პროფილი"]').waitFor({ state: 'attached', timeout: 30000 });
        return response;
      };
      if (isLogin) {
        const close = page.close.bind(page);
        page.close = async (...closeArgs) => {
          await page.locator('header button[aria-label="პროფილი"]').waitFor({ state: 'attached', timeout: 30000 });
          await context.storageState({ path: sessionPath });
          console.log(saved ? 'Reused authenticated company session; no login' : 'Authenticated company session saved; one UI login');
          return close(...closeArgs);
        };
      }
    });
    return context;
  };
  return browser;
};
