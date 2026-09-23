import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const p=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
async function loaded(){await p.waitForFunction(()=>document.querySelector('main')?.innerText && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'));await p.evaluate(()=>document.fonts.ready);}
async function shot(name){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(root,'qa/shots/'+name+'.png'),fullPage:false});}
try{
for(const mode of ['companies','requests']){
 await p.goto('http://localhost:3000/'+mode+'/');await p.locator('main article').first().waitFor();
 const search=p.locator('input[role="combobox"]');await search.focus();await p.locator('.search-suggestion').first().waitFor();await shot('discovery-'+mode+'-suggestions-1440');
 await search.press('ArrowUp');assert(await search.getAttribute('aria-activedescendant'));await search.press('Escape');assert.equal(await search.getAttribute('aria-expanded'),'false');
 await search.fill('ავეჯი');await p.waitForFunction(()=>document.querySelector('.search-suggestion')?.textContent.includes('ავეჯი'));await search.press('ArrowDown');await search.press('Enter');assert.equal(new URL(p.url()).searchParams.get(mode==='companies'?'industry':'category'),'furniture');assert.equal(await search.inputValue(),'');
 await p.locator('.filter-reset').first().click();await loaded();
 if(mode==='requests'){
  const zeroIds=await p.locator('main article').evaluateAll(es=>es.filter(e=>e.querySelector('.ma-rcard__offers b')?.textContent==='0').map(e=>e.querySelector('h2 a').getAttribute('href')).sort());
  await p.locator('.filter-rail').getByLabel('ჯერ არ აქვს შეთავაზება').check();await p.waitForFunction(()=>new URL(location.href).searchParams.get('unanswered')==='1');
  await p.waitForFunction(()=>[...document.querySelectorAll('main article .ma-rcard__offers b')].every(e=>e.textContent==='0'));
  assert.deepEqual((await p.locator('main article h2 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')))).sort(),zeroIds);
  await p.reload();await loaded();assert(await p.locator('.filter-rail').getByLabel('ჯერ არ აქვს შეთავაზება').isChecked());
  await p.locator('.filter-reset').first().click();await p.locator('#period-desktop').selectOption('7');assert.equal(new URL(p.url()).searchParams.get('period'),'7');await p.goBack();assert.equal(await p.locator('#period-desktop').inputValue(),'');
  await p.locator('.filter-rail').getByLabel('მხოლოდ ფოტოთი').check();await p.waitForFunction(()=>[...document.querySelectorAll('main article')].every(e=>e.querySelector('img')));
 }else{
  await p.locator('#company-type-desktop').selectOption('distributors');await p.waitForFunction(()=>[...document.querySelectorAll('.listing-industry')].every(e=>e.textContent.includes('ლოგისტიკა')));assert.equal(new URL(p.url()).searchParams.get('type'),'distributors');
  await p.locator('.filter-reset').first().click();await p.locator('#sort').selectOption('name');const names=await p.locator('.listing-heading h3').allTextContents();assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,'ka')));
 }
 await p.locator('.filter-reset').first().click();if(mode==='companies')await p.locator('.ma-call').first().waitFor();await shot('discovery-'+mode+'-1440');
 for(const width of [390,320]){await p.setViewportSize({width,height:900});await search.focus();await shot('discovery-'+mode+'-suggestions-'+width);await search.press('Escape');await p.getByRole('button',{name:/ფილტრი \(/}).click();await shot('discovery-'+mode+'-filters-'+width);const box=p.locator('dialog[open]').getByRole('checkbox').first();await box.check();await shot('discovery-'+mode+'-conditions-'+width);await p.keyboard.press('Escape');assert(await p.getByRole('button',{name:/ფილტრი \(/}).evaluate(e=>e===document.activeElement));await p.getByRole('button',{name:/ფილტრი \(/}).click();await box.uncheck();await p.keyboard.press('Escape');}
 await p.setViewportSize({width:1440,height:1000});console.log('PASS autocomplete + filters',mode);
}
await p.goto('http://localhost:3000/');await loaded();const home=p.locator('#home-search');await home.focus();await p.locator('.search-suggestion').first().waitFor();await shot('discovery-home-1440');for(const width of [390,320]){await p.setViewportSize({width,height:900});assert(await p.locator('.market-search-types label').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth)));await shot('discovery-home-'+width);}await home.fill('შეუძლებელისაძიებოტექსტი');await p.getByRole('status').filter({hasText:'შეთავაზება ვერ მოიძებნა'}).waitFor();await home.fill('ავეჯი');await home.press('ArrowDown');await home.press('Enter');await p.waitForURL('**/companies/?industry=furniture');console.log('PASS home real suggestions, no matches, keyboard navigation');
const direct=p.locator('input[role="combobox"]');await p.locator('main article').first().waitFor();await direct.focus();const last=p.locator('.search-suggestion').last();const title=await last.locator('strong').innerText();assert((await p.locator('.listing-heading h3').allTextContents()).includes(title),'suggestions honor the active category');await last.click();await p.waitForURL(url=>url.pathname==='/companies/view/');await p.getByRole('heading',{name:title,exact:true}).waitFor();console.log('PASS real record selection opens matching profile');
assert.deepEqual(errors,[]);
}finally{await browser.close();}
