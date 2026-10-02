"use client";
import { useCallback } from 'react';
import { useMarketStore } from './market-client';
import { useBusinessResource } from './business-client';
export type SiteContent = Record<string,string>;
export function useSiteContent(){
 const {store}=useMarketStore();
 const read=store?.siteContent;
 const load=useCallback(()=>read!(),[read]);
 const resource=useBusinessResource<SiteContent>(store?load:undefined,'site-content');
 return resource.data||{};
}
