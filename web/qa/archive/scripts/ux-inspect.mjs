import { chromium } from 'playwright';
const b = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('http://127.0.0.1:3031/requests/');
await p.locator('.request-card').first().waitFor();
await p.locator('.card-main-link').first().click();
await p.locator('.request-description').waitFor();
console.log(await p.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,cls:el.className,w:el.getBoundingClientRect().width,display:getComputedStyle(el).display,flex:getComputedStyle(el).flex})).slice(0,15)));
await b.close();
