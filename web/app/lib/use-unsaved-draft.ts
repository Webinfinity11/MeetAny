"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export function useUnsavedDraft(dirty:boolean){
 useEffect(()=>{if(!dirty)return;const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty]);
}

/** Capture internal links before Next handles navigation; reloads use beforeunload. */
export function useUnsavedGuard(dirty: boolean) {
 const router = useRouter();
 const [destination, setDestination] = useState<string | null>(null);
 useUnsavedDraft(dirty);
 useEffect(() => {
  if (!dirty) return;
  const protect = (event: MouseEvent) => {
   if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
   const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
   if (!link || link.download || (link.target && link.target !== '_self')) return;
   const url = new URL(link.href, window.location.href);
   if (url.origin !== window.location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
   event.preventDefault(); event.stopPropagation();
   setDestination(url.pathname + url.search + url.hash);
  };
  document.addEventListener('click', protect, true);
  return () => document.removeEventListener('click', protect, true);
 }, [dirty]);
 return { open: destination !== null, stay: () => setDestination(null), leave: () => {
  if (destination) {setDestination(null); router.push(destination);}
 }};
}
