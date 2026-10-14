import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE=process.env.BASE||'http://127.0.0.1:3441', AUTH=process.env.AUTH||'http://127.0.0.1:4441', OUT=process.env.OUT||'qa/LAYOUT-2026-10-14/catalog/after';
assert([BASE,AUTH].every(u=>new URL(u).hostname==='127.0.0.1'));fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=process.env.AUTH_ONLY?JSON.parse(fs.readFileSync(`${OUT}/verification.json`,'utf8')):{layouts:[],interactions:[],errors:[]};
delete report.failure;
async function context(width,signedIn=false){
 const id='bacf1572-7493-4ac9-bfc7-95719e911c4c', jwt=signedIn?(await(await fetch(`${AUTH}/__mint?sub=${id}`)).json()).token:null;
 const ctx=await browser.newContext({viewport:{width,height:width<=390?844:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 await ctx.route(`${AUTH}/**`,route=>{const url=route.request().url();if(url.includes('/.well-known/'))return route.continue();return route.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt',...(jwt?{'set-auth-jwt':jwt}:{})},json:url.includes('/get-session')?(jwt?{user:{id,email:'qa@local.test',name:'QA'}}:null):{token:jwt}})});
 await ctx.route(/https:\/\/.*\/auth\//,route=>route.abort());
 await ctx.addInitScript(({signedIn})=>{localStorage.setItem('meetany.theme','blue');if(signedIn)localStorage.setItem('meetany.session','1')},{signedIn});return ctx;
}
async function settle(p,slug){await p.goto(`${BASE}/${slug==='home'?'':slug+'/'}`);await p.locator('article').first().waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForLoadState('networkidle',{timeout:1500}).catch(()=>{});await p.addStyleTag({content:'nextjs-portal { display: none !important; }'});}
try{
 for(const width of (process.env.AUTH_ONLY?[]:[320,360,390,1440])){
  const ctx=await context(width),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  for(const slug of ['requests','companies','home']){
   await settle(p,slug);const selector=slug==='home'?'article[data-request-id]':'.catalog-main article';
   const row=await p.locator(selector).evaluateAll((es,slug)=>{const boxes=es.map(e=>{const b=e.getBoundingClientRect();return {y:b.y+scrollY,height:b.height,x:b.x,width:b.width}});return {slug,width:innerWidth,scrollHeight:document.documentElement.scrollHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),rows:boxes,firstY:boxes[0]?.y,firstScreen:boxes.filter(b=>b.y+b.height<=innerHeight).length,afterScroll:boxes.filter(b=>b.y>=boxes[0].y&&b.y+b.height<=boxes[0].y+844-56).length}},slug);
   report.layouts.push(row);console.log(slug,width,row.firstY);assert.equal(row.overflow,0,`${slug} ${width} overflow`);if(slug==='home')continue;
   const card=p.locator(selector).first(),link=card.locator('a.card-main-link'),href=await link.getAttribute('href');
   const controls=await card.locator('button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert(controls.every(x=>x.w>=44&&x.h>=44),`${slug} touch targets`);
   if(width===390){
    assert(row.firstY<=300,`${slug}: first row starts at ${row.firstY}`);assert(row.firstScreen>=1&&row.afterScroll>=3);await p.screenshot({path:`${OUT}/${slug}-viewport-390.png`});
    const save=card.getByRole('button',{name:slug==='requests'?'მოთხოვნის შენახვა':'კომპანიის შენახვა'});await save.click();await p.locator('dialog[open]').waitFor();assert.equal(new URL(p.url()).pathname,`/${slug}/`);await p.keyboard.press('Escape');await p.locator('dialog[open]').waitFor({state:'hidden'});
    const filter=p.locator('.catalog-filter-toggle');await filter.focus();await p.keyboard.press('Enter');const dialog=p.locator('#filters[open]');await dialog.waitFor();assert(await dialog.evaluate(e=>e.contains(document.activeElement)));
    for(let i=0;i<40;i++){await p.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)))}await p.keyboard.press('Shift+Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)));await dialog.locator('label[for$="-sheet-sort"]').scrollIntoViewIfNeeded();await p.screenshot({path:`${OUT}/${slug}-filters-390.png`});
    const sort=dialog.locator(`#${slug==='requests'?'request':'company'}-sheet-sort`);await sort.click();await p.getByRole('option',{name:slug==='requests'?'მალე იწურება':'უახლესი',exact:true}).click();await p.waitForURL(u=>u.searchParams.get('sort')===(slug==='requests'?'expiring':'newest'));
    await dialog.getByRole('checkbox',{name:/თბილისი/}).check();await p.waitForURL(u=>u.searchParams.get('city')==='tbilisi');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await filter.evaluate(e=>e===document.activeElement));await p.reload();await p.locator('article').first().waitFor();assert.equal(new URL(p.url()).searchParams.get('city'),'tbilisi');await settle(p,slug);
    if(slug==='companies'){await p.getByRole('button',{name:'რუკა',exact:true}).click();await p.waitForURL(u=>u.searchParams.get('view')==='map');await p.locator('.leaflet-container').waitFor();await p.getByRole('button',{name:'ბადე',exact:true}).click();await p.waitForURL(u=>u.searchParams.get('view')==='grid');await p.locator('article').first().waitFor();await p.getByRole('button',{name:'სია',exact:true}).click();await p.waitForURL(u=>!u.searchParams.has('view'))}
    report.interactions.push(`${slug}: guest save dialog, keyboard trap/return, sort, city, URL reload${slug==='companies'?', map/grid/list':''}`);
   }
   if(width===1440){if(slug==='requests'){await p.getByRole('button',{name:'სია',exact:true}).click();assert.equal(await p.locator(selector).evaluateAll(es=>new Set(es.map(e=>e.getBoundingClientRect().x)).size),1);await p.getByRole('button',{name:'ბადე',exact:true}).click();}await card.hover();await p.screenshot({path:`${OUT}/${slug}-hover-1440.png`});await link.focus();await p.screenshot({path:`${OUT}/${slug}-focus-1440.png`})}
   const box=await card.boundingBox();await p.mouse.click(box.x+5,box.y+box.height-5);await p.waitForURL(u=>u.pathname.includes('/view/'),{waitUntil:'domcontentloaded',timeout:60000});assert(p.url().endsWith(href),`${slug} stretched link`);report.interactions.push(`${slug} ${width}: whole card link and 44px controls`);
  }await ctx.close();
 }
 const ctx=await context(390,true),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 for(const slug of ['requests','companies']){await settle(p,slug);await p.locator('button[aria-controls="ma-account-menu"]').waitFor({state:'attached'});const save=p.locator('.catalog-main article').getByRole('button',{name:/შენახვა|შენახვის/}).first();const before=await save.getAttribute('aria-pressed');await save.click();await p.waitForFunction(({slug,before})=>document.querySelector(`.${slug}-catalog .catalog-main article button[aria-pressed]`)?.getAttribute('aria-pressed')!==before,{slug,before});assert.equal(new URL(p.url()).pathname,`/${slug}/`);await save.click();await p.waitForFunction(({slug,before})=>document.querySelector(`.${slug}-catalog .catalog-main article button[aria-pressed]`)?.getAttribute('aria-pressed')===before,{slug,before});report.interactions.push(`${slug}: signed-in save toggles and restores original state`)}
 await ctx.close();assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;process.exitCode=1}finally{fs.writeFileSync(`${OUT}/verification.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({layouts:report.layouts.map(({slug,width,scrollHeight,firstY,firstScreen,afterScroll,rows})=>({slug,width,scrollHeight,firstY,firstScreen,afterScroll,heights:[...new Set(rows.map(r=>r.height))]})),interactions:report.interactions,errors:report.errors,failure:report.failure},null,2))}
