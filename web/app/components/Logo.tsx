import type { CSSProperties } from "react";
import styles from "./Logo.module.css";

export function Logo({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  return <span className={`${styles.logo}${inverted ? ` ${styles.inverted}` : ""}`} style={{ "--logo-h": `${size}px` } as CSSProperties}>
    <svg className={styles.mark} viewBox="0 0 64 49" aria-hidden="true">
      <path fill="currentColor" d="M13 2h12c4 0 6.5 1.2 7 3.2C32.5 3.2 35 2 39 2h12c6 0 11 5 11 11v18c0 4.5-3 8-7 9.3V48l-8.5-7.5H17.5L9 47.5v-7.2C5 39 2 35.5 2 31V13C2 7 7 2 13 2Z" />
      <g className={styles.cut}><circle cx="18" cy="14" r="5.2"/><circle cx="46" cy="14" r="5.2"/>
      <path d="M10 37V29c0-4.4 3.6-8 8-8 2.6 0 4.6 1.1 6.4 2.9L32 31.5l7.6-7.6c1.8-1.8 3.8-2.9 6.4-2.9 4.4 0 8 3.6 8 8v8h-6v-8c0-1.1-.9-2-2-2-.6 0-1.1.2-1.5.6L32 40.1 19.5 27.6c-.4-.4-.9-.6-1.5-.6-1.1 0-2 .9-2 2v8h-6Z"/></g>
    </svg><span>MeetAny</span>
  </span>;
}
