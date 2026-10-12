import { verifyCaller, verifyNeonJwt } from '../../lib/neon-jwt.js';
import { asCaller } from '../../lib/db.js';
type FileDatabase={query:(sql:string,args?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>};
export const runtime = 'nodejs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function failure(error: unknown) {
 const e=error as {status?:number;code?:string};
 const status=e.status===401?401:e.code==='P0001'?403:e.code?.startsWith('22')?400:503;
 return Response.json({message:status===401?'ანგარიშში შესვლა საჭიროა.':status===403?'ფაილზე წვდომა შეზღუდულია ან მონაცემები შეიცვალა.':'ფაილი ვერ დამუშავდა. სცადეთ ხელახლა.'},{status,headers});
}
export async function POST(request: Request) {
 try {
  const claims=await verifyNeonJwt(request.headers.get('authorization'));
  const id=new URL(request.url).searchParams.get('upload');
  if (id) {
   const offset=Number(new URL(request.url).searchParams.get('offset'));
   if (!uuid.test(id)||!Number.isInteger(offset)||offset<0||Number(request.headers.get('content-length'))>1048576) return Response.json({message:'არასწორი ნაწილი'},{status:400,headers});
   const chunk=Buffer.from(await request.arrayBuffer());
   if(!chunk.length||chunk.length>1048576)return Response.json({message:'ნაწილი მაქსიმუმ 1 მბ'},{status:413,headers});
   const result=await asCaller(claims,async (db:FileDatabase)=>(await db.query('select public.append_file_chunk($1,$2,$3) as offset',[id,offset,chunk])).rows[0]);
   return Response.json(result,{headers});
  }
  const raw=await request.text();
  if(raw.length>4096)return Response.json({message:'არასწორი მოთხოვნა'},{status:413,headers});
  const b=JSON.parse(raw);
  if(b.action==='finish'&&uuid.test(b.id||'')) {
   const result=await asCaller(claims,async (db:FileDatabase)=>(await db.query('select public.finish_file_upload($1) as file',[b.id])).rows[0].file);
   return Response.json(result,{headers});
  }
  if(b.action!=='begin'||!uuid.test(b.target||''))return Response.json({message:'არასწორი მოთხოვნა'},{status:400,headers});
  const result=await asCaller(claims,async (db:FileDatabase)=>(await db.query('select public.begin_file_upload($1,$2,$3,$4,$5,$6) as id',[b.kind,b.target,b.name,b.mime,b.size,b.slot||''])).rows[0]);
  return Response.json(result,{headers});
 }catch(error){return failure(error);}
}
export async function GET(request: Request) {
 try {
  const id=new URL(request.url).searchParams.get('id');
  if(!id||!uuid.test(id))return Response.json({message:'ფაილი არ არის მითითებული'},{status:400,headers});
  const claims=await verifyCaller(request.headers.get('authorization'));
  const f=await asCaller(claims,async (db:FileDatabase)=>(await db.query('select (public.get_attachment($1)).*',[id])).rows[0]) as {content:Buffer;mime:string;name:string};
  return new Response(new Uint8Array(f.content),{headers:{...headers,'Content-Type':f.mime,'Content-Length':String(f.content.length),'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`}});
 }catch(error){return failure(error);}
}
