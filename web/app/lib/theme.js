// Both palettes share layout and component tokens; only the document theme changes.
export const THEME_STORAGE_KEY = "meetany.theme";
export const THEME_CHANGE_EVENT = "meetany:theme-change";
export const DEFAULT_THEME = "classic";

export function normalizeTheme(value) {
  return value === "blue" ? "blue" : DEFAULT_THEME;
}

// Runs synchronously in <head>, before the first painted page and React hydration.
export const themeBootstrap = `try{document.documentElement.dataset.theme=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="blue"?"blue":"classic"}catch{}`;

export function readTheme() {
  return typeof document === "undefined" ? DEFAULT_THEME : normalizeTheme(document.documentElement.dataset.theme);
}

export function applyTheme(value, persist = true) {
  const theme = normalizeTheme(value);
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* The toggle still works when storage is unavailable. */ }
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeTheme(listener) {
  window.addEventListener(THEME_CHANGE_EVENT, listener);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, listener);
}

export function syncThemeStorage(event) {
  if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(event.newValue, false);
}
