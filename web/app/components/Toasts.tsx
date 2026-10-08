"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import styles from "./Toasts.module.css";
export type ToastMessage = { title: string; sub?: string; tone?: "success" | "info" | "warning" | "danger"; action?: { label: string; onClick: () => void } };
export function toast(message: string | ToastMessage) { window.dispatchEvent(new CustomEvent("meetany:toast", { detail: typeof message === "string" ? { title: message, tone: "success" } : message })); }
type Item = ToastMessage & { id: number };
function ToastItem({ item, dismiss }: { item: Item; dismiss: (id: number) => void }) {
  const remaining = useRef(5000);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const pause = () => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; remaining.current = Math.max(0, remaining.current - (Date.now() - started.current)); }
  };
  const resume = useCallback(() => {
    if (hovered.current || focused.current || timer.current !== null) return;
    started.current = Date.now();
    timer.current = setTimeout(() => dismiss(item.id), remaining.current);
  }, [dismiss, item.id]);
  useEffect(() => { resume(); return () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } }; }, [resume]);
  const tone = item.tone || "success";
  return <div className={styles.toast} data-tone={tone} onMouseEnter={() => { hovered.current = true; pause(); }} onMouseLeave={() => { hovered.current = false; resume(); }}
    onFocus={() => { focused.current = true; pause(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; resume(); } }}>
    <Icon name={{ success: "circle-check", info: "info", warning: "triangle-alert", danger: "circle-alert" }[tone]} className={styles.icon} />
    <div className={styles.copy}><p className={styles.title}>{item.title}</p>{item.sub ? <p className={styles.sub}>{item.sub}</p> : null}</div>
    {item.action ? <button type="button" className={styles.action} onClick={() => { item.action?.onClick(); dismiss(item.id); }}>{item.action.label}</button> : null}
    <button type="button" className={styles.close} aria-label="შეტყობინების დახურვა" onClick={() => dismiss(item.id)}><Icon name="x" /></button>
  </div>;
}
export function Toasts() {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems(old => old.filter(item => item.id !== id)), []);
  useEffect(() => {
    let next = 0;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<string | ToastMessage>).detail;
      const item = { ...(typeof detail === "string" ? { title: detail } : detail), id: ++next };
      setItems(old => [...old.slice(-2), item]);
    };
    window.addEventListener("meetany:toast", receive);
    return () => window.removeEventListener("meetany:toast", receive);
  }, []);
  return <div className={styles.toasts} aria-live="polite" aria-relevant="additions text">{items.map(item => <ToastItem key={item.id} item={item} dismiss={dismiss} />)}</div>;
}
