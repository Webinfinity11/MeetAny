import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://127.0.0.1:3446', AUTH = process.env.AUTH || 'http://127.0.0.1:4446';
if (![BASE, AUTH].every(url => ['127.0.0.1','localhost'].includes(new URL(url).hostname))) throw new Error('Local fixtures only');
const phase = process.argv[2] || 'after';
const out = new URL(`./${phase}/`, import.meta.url);
fs.mkdirSync(out, { recursive: true });
const id = '74cc28fc-47de-45cb-9563-93735b86855e';
const jwt = (await (await fetch(`${AUTH}/__mint?sub=${id}`)).json()).token;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const rows = [];
try {
for (const width of (process.env.WIDTHS || (phase === 'before' ? '1440,390,360' : '1440,1280,1024,390,360')).split(',').map(Number)) {
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block' });
  await context.route(`${AUTH}/**`, route => route.request().url().includes('/.well-known/') ? route.continue() : route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', 'set-auth-jwt': jwt }, json: route.request().url().includes('/get-session') ? { user: { id, email: 'qa@local.test', name: 'QA' } } : { token: jwt } }));
  await context.route(/https:\/\/.*\/auth\//, route => route.abort());
  await context.addInitScript(theme => { localStorage.setItem('meetany.session','1'); localStorage.setItem('meetany.theme',theme); }, phase === 'blue' ? 'blue' : 'classic');
  const page = await context.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const step of ['type','details','profile','provide','need','verify','review']) {
    errors = [];
    await page.goto(`${BASE}/onboarding/?step=${step}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('form').waitFor({timeout:60000});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(450);
    const data = await page.evaluate(() => {
      const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      const brokenWords=[];
      for (const el of document.querySelectorAll('h1,h2,label strong,[class*="intentCopy"]')) {
        if (!visible(el)) continue;
        const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node=walker.currentNode;
          for(const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)) {
            const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
            if(new Set([...range.getClientRects()].map(r=>Math.round(r.top))).size>1)brokenWords.push(match[0]);
          }
        }
      }
      const current=[...document.querySelectorAll('nav[aria-label="პროფილის ნაბიჯები"] [aria-current="step"]')].filter(visible).map(el=>({text:el.textContent,label:el.getAttribute('aria-label')}));
      const footer=document.querySelector('[data-form-footer]') || document.querySelector('[class*="actions"]');
      const buttons=footer?[...footer.querySelectorAll('button')].filter(visible).map(el=>({text:el.textContent,height:el.getBoundingClientRect().height})):[];
      const rect = el => el?.getBoundingClientRect();
      const form = document.querySelector('form'), aside = document.querySelector('aside');
      const radioHeights=[...document.querySelectorAll('label:has(input[type=radio])')].map(el=>rect(el).height);
      const footerMatchesForm=innerWidth<1024 || (Math.abs(rect(footer).left-rect(form).left)<1 && Math.abs(rect(footer).width-rect(form).width)<1);
      const asideOutsideForm=!!aside && !form.contains(aside);
      const previewOpen=document.querySelector('aside details')?.open;
      return {radioHeights,footerMatchesForm,asideOutsideForm,previewOpen, scrollHeight: document.documentElement.scrollHeight, overflow: Math.max(0,document.documentElement.scrollWidth-innerWidth), brokenWords, current, buttons, title:document.querySelector('h1')?.textContent, formWidth:document.querySelector('form')?.getBoundingClientRect().width };
    });
    let axe=[];
    if(phase !== 'before'){
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      axe=await page.evaluate(async()=> (await window.axe.run({runOnly:['wcag2a','wcag2aa','wcag21aa','best-practice']})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    if(phase !== 'blue' && [1440,390,360].includes(width))await page.screenshot({path:fileURLToPath(new URL(`${step}-${width}.png`,out)),fullPage:true});
    const row={step,width,...data,pageerror:[...errors],axe};rows.push(row);
    fs.writeFileSync(new URL('metrics.json',out),JSON.stringify(rows,null,2)+'\n');
    console.log(JSON.stringify({step,width,height:data.scrollHeight,overflow:data.overflow,broken:data.brokenWords.length,pageerror:errors.length,axe:axe.length}));
  }
  await context.close();
}
} finally { await browser.close(); }
if(phase !== 'before' && rows.some(r=>r.overflow||r.brokenWords.length||r.pageerror.length||r.axe.length||r.current.length!==1||r.buttons.some(b=>b.height<44)||!r.footerMatchesForm||!r.asideOutsideForm||r.previewOpen!==(r.width>=1024)||(r.radioHeights.length && Math.max(...r.radioHeights)-Math.min(...r.radioHeights)>1)))process.exitCode=1;
