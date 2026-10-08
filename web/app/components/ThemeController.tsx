"use client";

import { useEffect } from "react";
import { syncThemeStorage } from "../lib/theme";

/** Keep all tabs in sync, including pages with their own header. */
export function ThemeController() {
  useEffect(() => {
    window.addEventListener("storage", syncThemeStorage);
    return () => window.removeEventListener("storage", syncThemeStorage);
  }, []);
  return null;
}
