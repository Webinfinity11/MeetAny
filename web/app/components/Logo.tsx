import type { CSSProperties } from "react";
import Image from "next/image";

/* Keep the original logo colours. Dark surfaces use the light wordmark with the same coloured symbol. */
export function Logo({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  return <span className={`ma-logo${inverted ? " ma-logo--inverted" : ""}`} style={{ "--logo-h": `${size}px` } as CSSProperties}>
    <Image className="ma-logo__symbol" src="/assets/meetany-symbol-transparent.png" alt="" width={1496} height={1051} sizes={`${Math.ceil(size * 1.5)}px`} loading="eager" />
    <Image className="ma-logo__wordmark" src={inverted ? "/assets/meetany-wordmark-light.png" : "/assets/meetany-wordmark.png"} alt="MeetAny" width={683} height={171} sizes={`${Math.ceil(size * 3.2)}px`} loading="eager" />
  </span>;
}
