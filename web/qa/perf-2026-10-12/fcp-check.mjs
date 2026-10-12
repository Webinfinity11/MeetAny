import { chromium } from 'playwright';
const b = await chromium.launch();
for (const block of [false, true]) { const xs=[];
  for (let i=0;i<5;i++){ const c=await b.newContext({viewport:{width:1366,height:900}}); if(block) await c.route('**/_next/image/**', r=>r.abort());
    const p=await c.newPage(); await p.goto('http://127.0.0.1:3002/requests/view/?id=3c6c7198-9e2c-4950-9dfb-f32a1545ec26',{waitUntil:'load'});
    xs.push(await p.evaluate(()=>Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime))); await c.close(); }
  console.log(block?'images blocked':'images on', xs.join(' ')); }
await b.close();
