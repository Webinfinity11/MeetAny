// Local JWT only. MODE=before|after; captures filled steps without publishing.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://127.0.0.1:3444';
const AUTH = process.env.AUTH || 'http://127.0.0.1:4444';
if (![BASE, AUTH].every(url => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))) throw Error('Local only');
const mode = process.env.MODE || 'before';
const out = process.env.OUT || `qa/LAYOUT-2026-10-14/post/${mode}`;
fs.mkdirSync(out, { recursive: true });
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e' };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [], errors = [];
const date = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const draft = {title:'ხის მაგიდების შესყიდვა — განლაგების ინვენტარი',body:'სასტუმროსთვის სჭირდება 20 ხის მაგიდა, ზომა 120×80, მიწოდებით თბილისში.',category:'furniture',city:'tbilisi',addressNote:'საბურთალო',quantity:'20',unit:'pcs',neededByText:date.split('-').reverse().join('.'),at:Date.now()};
async function contextFor(role, width) {
  const jwt = (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
  const context = await browser.newContext({ viewport: {width,height:width<=390?844:1000}, serviceWorkers:'block' });
  await context.route(`${AUTH}/**`, route => {
    const url = route.request().url();
    if (url.includes('/.well-known/')) return route.continue();
    return route.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:url.includes('/get-session')?{user:{id:ids[role],email:'qa@local.test',name:'QA'}}:{token:jwt}});
  });
  await context.route(/https:\/\/.*\/auth\//, route => route.abort());
  await context.addInitScript(draft => {localStorage.setItem('meetany.session','1');localStorage.setItem('meetany.theme','blue');if(!sessionStorage.getItem('qa.seeded')){sessionStorage.setItem('meetany.requestDraft',JSON.stringify({...draft,at:Date.now()}));sessionStorage.setItem('qa.seeded','1');}},draft);
  return context;
}
async function settle(page) {
  await page.locator('button[aria-controls="ma-account-menu"]').waitFor({state:'attached',timeout:60000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}
async function capture(page, name, width, role='client') {
  // Attachment reads may finish after session readiness. Audit settled controls,
  // not the transient color while the upload button becomes enabled.
  await page.waitForFunction(() => !document.querySelector('main')?.innerText.includes('ფაილები იტვირთება'), null, {timeout:30000});
  await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  await page.evaluate(() => scrollTo(0,0));
  await page.waitForTimeout(200);
  const data = await page.evaluate(() => {
    const rect = selector => {const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
    const actions=[...document.querySelectorAll('[data-form-footer] button')].map(el=>{const r=el.getBoundingClientRect();return {label:el.textContent,height:r.height,width:r.width,visible:r.top>=0&&r.bottom<=innerHeight,unobscured:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    return {scrollHeight:document.documentElement.scrollHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),title:rect('main h1'),firstField:rect('#title'),form:rect('#post-request-form'),panel:rect('aside[aria-label="ასე ჩანს"]'),footer:rect('[data-form-footer]'),actions};
  });
  if(mode==='after') {
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    data.violations=await page.evaluate(async()=> (await window.axe.run({runOnly:['wcag2a','wcag2aa','wcag21aa','best-practice']})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
  }
  if([1440,390,360].includes(width)) await page.screenshot({path:`${out}/${name}-${role}-${width}.png`,fullPage:true});
  results.push({name,role,width,...data});
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({name,width,height:data.scrollHeight,overflow:data.overflow,violations:data.violations}));
}
try {
  for (const width of (process.env.WIDTHS || (mode==='before'?'1440,390,360':'1440,1280,1024,390,360')).split(',').map(Number)) {
    const context=await contextFor('client',width), page=await context.newPage();
    page.on('pageerror',e=>errors.push({width,error:e.message}));
    await page.goto(`${BASE}/requests/new/?step=1`,{waitUntil:'domcontentloaded',timeout:90000});await settle(page);
    await page.locator('#category').click();await page.getByRole('option',{name:'ავეჯი',exact:true}).click();
    await capture(page,'step1',width);
    if(mode==='after'&&width===360){
      const summary=page.locator('aside[aria-label="ასე ჩანს"] summary');
      await summary.focus();await page.keyboard.press('Enter');
      await page.locator('aside[aria-label="ასე ჩანს"] details[open]').waitFor();
      await capture(page,'preview-expanded',width);
      await summary.focus();await page.keyboard.press('Enter');
    }
    await page.locator('button.post-actions__next[type=submit]').click();await page.locator('#neededBy').waitFor();
    await page.locator('#neededBy').fill(date);await capture(page,'step2',width);
    await page.locator('button.post-actions__next[type=submit]').click();await page.getByText('მოთხოვნის დეტალები',{exact:true}).waitFor();
    await capture(page,'step3',width);
    await page.goto(`${BASE}/account/?tab=profile#company-upgrade`,{waitUntil:'domcontentloaded',timeout:90000});await settle(page);
    await page.locator('#upgrade-company').fill('სატესტო სასტუმრო');
    await page.locator('#upgrade-industry').click();await page.getByRole('option',{name:'ავეჯი',exact:true}).click();
    await capture(page,'company-upgrade',width);
    if(process.env.EDIT_ID){
      await page.goto(`${BASE}/requests/view/?id=${process.env.EDIT_ID}`,{waitUntil:'domcontentloaded',timeout:90000});await settle(page);
      await page.getByRole('button',{name:'რედაქტირება',exact:true}).click();await page.locator('dialog[open]').waitFor();
      await capture(page,'edit',width);await page.keyboard.press('Escape');
    }
    await context.close();
  }
} catch(error){errors.push({error:error.stack});throw error;}
finally {await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));}
if(errors.length || results.some(r=>r.overflow || r.violations?.some(v=>['serious','critical'].includes(v.impact))))process.exitCode=1;
