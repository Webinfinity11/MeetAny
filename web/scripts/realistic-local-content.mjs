// Presentation copy only, on the isolated local preview. Never connects to Neon.
import pg from 'pg';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.MEETANY_LOCAL_DATABASE_URL;
if(!url || !['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname) || !/^\/meetany_preview_\d+$/.test(new URL(url).pathname))throw new Error('Isolated preview database required');
const db=new pg.Client({connectionString:url});await db.connect();
try{
 await db.query('begin');
 const titles=await db.query("update public.requests set title=replace(title,'სადემო მაგალითი: ',''),body=case when body like 'სადემო მოთხოვნა%' then 'გვჭირდება პროდუქციის შერჩევა, ადგილზე მიწოდება და მონტაჟი. შეთავაზებაში მიუთითეთ მასალა, ზომები, ჯამური ფასი და შესრულების ვადა.' else body end where title like 'სადემო მაგალითი:%' returning id");
 const offers=await db.query("update public.offers set body='გთავაზობთ პროდუქციის შერჩევას და ადგილზე მიწოდებას. საბოლოო ზომებსა და მასალას წინასწარ შევათანხმებთ. შეთავაზება მოიცავს ტრანსპორტირებას; გადახდა შესაძლებელია საბანკო გადარიცხვით.' where body like 'სადემო შეთავაზება%' returning id");
 const profiles=await db.query("update public.profiles set about=btrim(replace(replace(about,'სადემო კომპანია. პრეზენტაციისთვის შექმნილი ინფორმაცია.',''),'სადემო კომპანია.','')) where about like 'სადემო კომპანია.%' returning id");
 await db.query('commit');console.log(`Local copy updated: ${titles.rowCount} request titles/descriptions, ${offers.rowCount} offer descriptions, ${profiles.rowCount} company descriptions. Remote writes: 0. Deleted records: 0.`);
}catch(e){await db.query('rollback');throw e;}finally{await db.end();}
