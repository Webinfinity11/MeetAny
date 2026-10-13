import fs from 'node:fs';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const phase=process.argv[2]||'before',dir='qa/CLEANUP-2026-10-14',origin='http://localhost:3711',auth='http://127.0.0.1:3721';
const browser=await chromium.launch(),results=[];
try {
for(const width of [1440,390,360]) for(const [name,path] of [['home','/'],['requests','/requests/'],['companies','/companies/'],['request','/requests/view/?id=012ca27c-5913-46e2-899f-254785bd3d23'],['company','/companies/view/?id=74cc28fc-47de-45cb-9563-93735b86855e'],['account','/account/'],['how','/how-it-works/'],['admin','/admin/']]) {
 const user=name==='admin'?'d2517b00-554d-4e6b-929a-ef3da51f3b47':null,jwt=user?(await(await fetch(`${auth}/__mint?sub=${user}`)).json()).token:null;
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await context.route(`${auth}/**`,route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt',...(jwt?{'set-auth-jwt':jwt}:{})},json:route.request().url().includes('/get-session')?(jwt?{user:{id:user,email:'perf@local.test',name:'perf'}}:null):{token:jwt}}));
 if(jwt)await context.addInitScript(()=>localStorage.setItem('meetany.session','1'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+path,{waitUntil:'networkidle'});if(user)await page.locator('#admin-section-navigation').waitFor({state:'attached',timeout:30000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),file=`${name}-${width}.png`;
 await page.screenshot({path:`${dir}/shots/${phase}-${file}`,fullPage:true,animations:'disabled'});
 const imageRects=await page.locator('img').evaluateAll(imgs=>imgs.map(img=>{const r=img.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};}));
 let diff=null, imageMaskedDiff=null;if(phase==='after'){const a=PNG.sync.read(fs.readFileSync(`${dir}/shots/before-${file}`)),b=PNG.sync.read(fs.readFileSync(`${dir}/shots/after-${file}`));diff=a.width===b.width&&a.height===b.height?pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.1}):'dimensions changed';if(a.width===b.width&&a.height===b.height){for(const r of imageRects)for(let y=Math.max(0,Math.floor(r.y));y<Math.min(a.height,Math.ceil(r.y+r.height));y++)for(let x=Math.max(0,Math.floor(r.x));x<Math.min(a.width,Math.ceil(r.x+r.width));x++){const i=(y*a.width+x)*4;a.data.fill(255,i,i+4);b.data.fill(255,i,i+4);}imageMaskedDiff=pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.1});}}
 results.push({name,path,width,overflow,errors,diff,imageMaskedDiff,imageRects});console.log(name,width,overflow,errors.length,diff);await context.close();
}
}finally{await browser.close();}
fs.writeFileSync(`${dir}/code-visual-${phase}.json`,JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length||r.overflow))process.exitCode=1;
