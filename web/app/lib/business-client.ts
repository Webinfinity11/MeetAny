"use client";
import { useEffect, useState } from "react";
import type { Store } from "./market-client";

export type BusinessFeature = {id:string;distributor:boolean;plan:"premium"|"vip"|null;rating:number|null;reviewCount:number};
export const businessError = (err: unknown) => (err as { userMessage?: string })?.userMessage || "ინფორმაცია ვერ ჩაიტვირთა. სცადე ხელახლა.";
/** Keys bind results to their route/owner; an old response never paints a different company's data. */
export function useBusinessResource<T>(load: (()=>Promise<T>)|undefined, key: string, refreshSignal?: number) {
 const [revision,setRevision]=useState(0);
 const [state,setState]=useState<{key:string;data?:T;error?:string}>();
 useEffect(()=>{let active=true;if(load)void load().then(data=>{if(active)setState({key,data});},err=>{if(active)setState({key,error:businessError(err)});});return()=>{active=false;};},[load,key,revision,refreshSignal]);
 const current=state?.key===key?state:undefined;
 return {data:current?.data,error:current?.error,loading:!current,replace:(data:T)=>setState({key,data}),reload:()=>setRevision(v=>v+1)};
}
export function useCompanyFeatures(store:Store|undefined,ready:boolean){
 return useBusinessResource<BusinessFeature[]>(ready && store?.isSessionReady()?store.companyBusinessFeatures:undefined,"public-features");
}
