"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, DEFAULT_THEME, readTheme, subscribeTheme } from "../lib/theme";
import { Button } from "./ui/Button";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_THEME);
  const isBlue = theme === "blue";
  const action = isBlue ? "შავ-თეთრ თემაზე გადართვა" : "ლურჯ თემაზე გადართვა";
  return <Button variant="secondary" className="ma-theme-toggle" aria-label="ლურჯი თემა" aria-pressed={isBlue} title={action} onClick={() => applyTheme(isBlue ? "classic" : "blue")}>
    <span className="ma-theme-toggle__swatch" aria-hidden="true" />
  </Button>;
}
