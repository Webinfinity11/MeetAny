import fs from 'node:fs';
import { chromium } from 'playwright';
const origin='http://localhost:3706', auth='http://127.0.0.1:3716';
const company='3d12ff1f-0d72-4a53-a92f-1830cfd5b290', admin='d2517b00-554d-4e6b-929a-ef3da51f3b47';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const only=process.env.QA_ONLY?.split(',');
const results=only?JSON.parse(fs.readFileSync('qa/p7-cleanup/results.json')):[];
async function context(user,width){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 const jwt=user?(await (await fetch(`${auth}/__mint?sub=${user}`)).json()).token:null;
 await ctx.route(`${auth}/**`,r=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt',...(jwt?{'set-auth-jwt':jwt}:{})},json:r.request().url().endsWith('/get-session')?(user?{user:{id:user,email:'qa@local.test',name:'QA'}}:null):{token:jwt}}));
 if(user) await ctx.addInitScript(()=>localStorage.setItem('meetany.session','1'));
 return ctx;
}
async function shot(page,name,width,errors){
 await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.complete?null:new Promise(resolve=>{i.onload=resolve;i.onerror=resolve;setTimeout(resolve,15000)})))});
 await page.waitForTimeout(400);
 await page.screenshot({path:`qa/p7-cleanup/shots/${name}-${width}.png`,fullPage:true});
 const stats=await page.evaluate(()=>({overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),images:[...document.images].filter(i=>i.getBoundingClientRect().width>0).map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,width:Math.round(i.getBoundingClientRect().width),height:Math.round(i.getBoundingClientRect().height)}))}));
 const previous=results.findIndex(r=>r.name===name&&r.width===width);if(previous>=0)results.splice(previous,1);
 results.push({name,width,...stats,pageerrors:[...errors]});fs.writeFileSync('qa/p7-cleanup/results.json',JSON.stringify(results,null,2));console.log(name,width,stats.overflow,stats.images.filter(i=>!i.loaded).length,errors.length);
}
try{
 for(const width of [1440,390,360]){
  for(const [name,path,user] of [
   ['ideas','/ideas/',null],['idea','/ideas/office-supply/',null],['company',`/companies/view/?id=${company}`,null],['request','/requests/view/?id=ea9e0391-2fba-44f1-8be3-84ea8896dab9',null],
   ['admin-photos','/admin/?tab=photos',admin],['admin-content','/admin/?tab=content',admin],['account-products','/account/?tab=profile&section=products',company],['account','/account/?tab=profile&section=details',company],['photo-field','/requests/new/',company]
  ].filter(([name])=>!only||only.includes(name))){
   const ctx=await context(user,width),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+path,{waitUntil:'networkidle',timeout:120000});
   await page.waitForFunction(() => !document.querySelector('.ma-skel,.account-loading-shell,.request-form__skeleton') && !(document.querySelector('main')?.innerText || '').includes('იტვირთება'),{},{timeout:60000});
   await page.waitForTimeout(1200);
   await shot(page,name,width,errors);
   if(name==='admin-photos'){
    const link=page.locator('button[class*="rowLink"]').filter({hasText:'QA მფლობელის კომპანია'}).first();if(await link.count()){await link.click();await page.getByRole('button',{name:'რედაქტირება',exact:true}).click();await shot(page,'admin-edit',width,errors);await page.locator('form[aria-label="პროფილის რედაქტირება"] img').last().scrollIntoViewIfNeeded();await shot(page,'admin-edit-photos',width,errors);}
   }
   if(name==='account'||name==='photo-field'){
    const input=name==='account'?page.locator('#profile-gallery'):page.locator('input[type=file]').first();
    if(await input.count()) {await input.setInputFiles('public/assets/photos/cardboard-packaging.jpg');await page.waitForTimeout(500);if(name==='photo-field')await page.locator('.post-photos__tile').scrollIntoViewIfNeeded();await shot(page,name+'-preview',width,errors);}
   }
   await ctx.close();
  }
 }
}finally{await browser.close();}
if(results.some(r=>r.overflow||r.pageerrors.length||r.images.some(i=>!i.loaded)))throw new Error('ვიზუალური QA: დაფიქსირდა overflow, pageerror ან ჩაუტვირთავი სურათი; იხილეთ results.json');
