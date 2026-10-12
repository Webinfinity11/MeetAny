import type { Store } from './market-client';
export type FileKind='request_draft'|'offer_draft'|'request'|'offer'|'conversation'|'verification'|'deal'|'issue';
export type Attachment={id:string;owner_id:string;kind:FileKind;target_id:string;slot:string;name:string;mime:string;size:number;created_at:string};
export const fileTypes=['application/pdf','image/jpeg','image/png','image/webp'];
async function responseData(response:Response) {const data=await response.json();if(!response.ok)throw new Error(data.message||'ფაილი ვერ აიტვირთა');return data;}
export async function uploadFile(store:Store,kind:FileKind,target:string,file:File,slot='',progress?:(value:number)=>void):Promise<Attachment> {
 if(!fileTypes.includes(file.type)||!file.size||file.size>10*1024*1024)throw new Error('აირჩიეთ PDF, JPG, PNG ან WEBP, მაქსიმუმ 10 მბ.');
 const begin=await responseData(await store.authenticatedFetch('/api/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'begin',kind,target,name:file.name.slice(0,180),mime:file.type,size:file.size,slot})}));
 for(let offset=0;offset<file.size;offset+=1048576){
  const body=file.slice(offset,Math.min(file.size,offset+1048576));
  const send=()=>store.authenticatedFetch(`/api/files?upload=${begin.id}&offset=${offset}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body});
  let response:Response;try{response=await send();}catch{response=await send();}
  await responseData(response);progress?.(Math.round(Math.min(file.size,offset+1048576)/file.size*100));
 }
 const finish=()=>store.authenticatedFetch('/api/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finish',id:begin.id})});
 let completed:Response;try{completed=await finish();}catch{completed=await finish();}if(completed.status>=500)completed=await finish();
 return responseData(completed);
}
export async function downloadFile(store:Store,file:Attachment) {
 const response=await store.authenticatedFetch(`/api/files?id=${file.id}`);
 if(!response.ok){await responseData(response);return;}
 const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
