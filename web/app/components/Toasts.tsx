"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
export function toast(message: string) { window.dispatchEvent(new CustomEvent("meetany:toast", {detail: message})); }
export function Toasts() {
  const [items, setItems] = useState<{id: number; message: string}[]>([]);
  useEffect(() => {
    let next = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const receive = (e: Event) => {
      const id = ++next;
      setItems(old => [...old.slice(-2), {id, message: (e as CustomEvent<string>).detail}]);
      const timer = setTimeout(() => {setItems(old => old.filter(t => t.id !== id)); timers.delete(timer);}, 5000);
      timers.add(timer);
    };
    window.addEventListener("meetany:toast", receive);
    return () => {window.removeEventListener("meetany:toast", receive); timers.forEach(clearTimeout);};
  }, []);
  return <div className="ma-toasts" aria-live="polite">{items.map(t => <div className="ma-toast" role="status" key={t.id}><Icon name="info"/><span className="ma-toast__text">{t.message}</span><button className="ma-toast__close" aria-label="დახურვა" onClick={() => setItems(items.filter(i => i.id !== t.id))}><Icon name="x"/></button></div>)}</div>;
}
