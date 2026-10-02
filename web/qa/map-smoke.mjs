import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3004/companies/?view=map');
await page.locator('.leaflet-control-attribution').waitFor({timeout:60000});
await page.waitForFunction(()=>document.querySelector('.companies-map__canvas')?.getAttribute('aria-busy')==='false',{timeout:45000});
assert.equal(await page.locator('.map-pin__initials').count(),0);
assert(!(await page.locator('.leaflet-control-attribution').innerText()).includes('Leaflet'));
assert((await page.locator('.leaflet-control-attribution').innerText()).includes('OpenStreetMap'));
const filter=await page.locator('.leaflet-tile-pane').evaluate(e=>getComputedStyle(e).filter);assert(filter.includes('grayscale'));
console.log('catalog markers',await page.locator('.map-pin').count(),'clusters',await page.locator('.map-cluster').count(),'filter',filter);
await page.locator('.companies-map').screenshot({path:'/tmp/meetany-map-catalog.png'});
if(await page.locator('.map-pin').count()){await page.locator('.map-pin').first().click();await page.locator('.map-popup__name').waitFor();assert((await page.locator('.map-popup__name').getAttribute('href')).startsWith('/companies/view/'));await page.keyboard.press('Escape');}
await page.setViewportSize({width:390,height:850});await page.waitForTimeout(500);assert(await page.evaluate(()=>document.documentElement.scrollWidth)<=390);await page.locator('.companies-map').screenshot({path:'/tmp/meetany-map-mobile.png'});
assert.deepEqual(errors,[]);console.log('PASS map desktop/mobile, loadedtiles, attribution, noinitials, popup links, no runtime errors');
await browser.close();
