export function LogoMark({ size = 30, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? "var(--white)" : "var(--ink-950)";
  const cut = inverted ? "var(--ink-950)" : "var(--white)";
  return (
    <svg width={size * 1.3} height={size} viewBox="0 0 64 49" aria-hidden="true">
      <path fill={ink} d="M13 2h12c4 0 6.5 1.2 7 3.2C32.5 3.2 35 2 39 2h12c6 0 11 5 11 11v18c0 4.5-3 8-7 9.3V48l-8.5-7.5H17.5L9 47.5v-7.2C5 39 2 35.5 2 31V13C2 7 7 2 13 2Z" />
      <circle cx="18" cy="14" r="5.2" fill={cut} />
      <circle cx="46" cy="14" r="5.2" fill={cut} />
      <path fill={cut} d="M10 37V29c0-4.4 3.6-8 8-8 2.6 0 4.6 1.1 6.4 2.9L32 31.5l7.6-7.6c1.8-1.8 3.8-2.9 6.4-2.9 4.4 0 8 3.6 8 8v8h-6v-8c0-1.1-.9-2-2-2-.6 0-1.1.2-1.5.6L32 40.1 19.5 27.6c-.4-.4-.9-.6-1.5-.6-1.1 0-2 .9-2 2v8h-6Z" />
    </svg>
  );
}

export function Logo({ inverted = false, size = 28 }: { inverted?: boolean; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--size-10)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.025em", lineHeight: 1, whiteSpace: "nowrap", color: inverted ? "var(--white)" : "var(--ink-950)", fontSize: size * 0.75 }}>
    <LogoMark size={size} inverted={inverted} />MeetAny
  </span>;
}
