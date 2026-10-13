import {actor,goto,capture,state,check,finish,assert} from './harness.mjs';
const guest=await actor('guest'),admin=await actor('owner_admin');
try{
await check('published content image decoded URL proof',async()=>{await goto(guest.p,'/companies/');await guest.p.waitForFunction(url=>[...document.querySelectorAll('.catalog-collage img')].some(i=>decodeURIComponent(i.src).includes(url)),state.contentPreview,{timeout:15000});await capture(guest.p,'guest-content-confirmed');return {matched:true};});
await check('restore catalog default image through admin UI',async()=>{await goto(admin.p,'/admin/?tab=content');await admin.p.getByRole('button',{name:'საწყისი ფოტოს დაბრუნება',exact:true}).first().click();await admin.p.getByRole('button',{name:'ცვლილებების გამოქვეყნება',exact:true}).click();await admin.p.getByText('კატალოგის ფოტოები გამოქვეყნდა.',{exact:true}).first().waitFor();await goto(guest.p,'/companies/');await capture(guest.p,'guest-content-restored');assert(!(await guest.p.locator('.catalog-collage img').evaluateAll((items,url)=>items.some(i=>decodeURIComponent(i.src).includes(url)),state.contentPreview)));});
}finally{await finish();}
