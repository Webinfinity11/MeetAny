// builds seed SQL + copies photos mirroring the beta demo data
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.argv[2], FILES=process.argv[3], DIST='/Users/kapana/Desktop/infinty/MeetAny/site/dist';
const d=JSON.parse(fs.readFileSync('beta-data.json','utf8'));
const q=s=>s==null?'null':"'"+String(s).replace(/'/g,"''")+"'";
const users={};let n=0;const out=[];
const phone=()=>{n++;return '+995 555 '+String(100+n).padStart(3,'0')+' '+String(200+n).padStart(3,'0');};
function user(u,role,industry){ if(users[u.id])return users[u.id]; const id=crypto.randomUUID();users[u.id]=id;
 const meta={role,name:u.name||'სახელი გვარი',company:u.company||'კომპანია',phone:phone(),city:u.city||'tbilisi',industry};
 out.push(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${u.id}.${n}@seed.ge',now(),${q(JSON.stringify(meta))}::jsonb);`);
 return id;}
const companies=['ავეჯი პლუსი','სამშენებლო ჯგუფი','ლოჯისტიკა 24','ციფრული სტუდია'].map((c,i)=>user({id:'co'+i,company:c,name:'კომპანია '+i,city:'tbilisi'},'company','furniture'));
out.push(`update public.profiles set verified=true where id='${companies[0]}';`);
for(const r of d.reqs){const oid=user(r.owner,'client');let photo=null;
 if(r.photo){const f=path.basename(r.photo);const dir=path.join(FILES,'request-photos',oid);fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(path.join(DIST,r.photo),path.join(dir,f));
  photo=`http://127.0.0.1:${PORT}/storage/v1/object/public/request-photos/${oid}/${f}`;
  out.push(`insert into storage.objects(bucket_id,name,owner) values('request-photos','${oid}/${f}','${oid}') on conflict do nothing;`);}
 const rid=crypto.randomUUID();
 out.push(`insert into public.requests(id,owner_id,title,body,category,city,photo_url,created_at,expires_at) values('${rid}','${oid}',${q(r.title)},${q(r.body)},${q(r.category)},${q(r.city)},${q(photo)},${q(r.createdAt)},${q(r.expiresAt)});`);
 for(let i=0;i<r.count;i++) out.push(`insert into public.offers(request_id,company_id,body,price) values('${rid}','${companies[i]}','შეთავაზების ტექსტი ნომერი ${i}',1000);`);
 if(r.id==='r-chairs') fs.writeFileSync('chairs-id.txt',rid);
}
fs.writeFileSync('seed.sql',out.join('\n'));
