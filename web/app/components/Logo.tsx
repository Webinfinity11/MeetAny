import type { CSSProperties } from "react";
import Image from "next/image";

/* The original MeetAny logo stays (owner, 2026-10-07): the PNG symbol and wordmark, colours untouched.
   This wrapper only sizes them (served resized: the symbol PNG alone is 516 KB); `inverted` picks the light wordmark for dark surfaces such as the footer. */
export function Logo({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  return <span className={`ma-logo${inverted ? " ma-logo--inverted" : ""}`} style={{ "--logo-h": `${size}px` } as CSSProperties}>
    <Image className="ma-logo__symbol" src="/assets/meetany-symbol-transparent.png" alt="" width={1496} height={1051} sizes={`${Math.ceil(size * 1.5)}px`} loading="eager" />
    <Image className="ma-logo__wordmark" src={inverted ? "/assets/meetany-wordmark-light.png" : "/assets/meetany-wordmark.png"} alt="MeetAny" width={683} height={171} sizes={`${Math.ceil(size * 3.2)}px`} loading="eager" />
  </span>;
}
