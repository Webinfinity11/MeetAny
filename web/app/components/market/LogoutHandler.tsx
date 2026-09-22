"use client";

import { useEffect } from "react";

// shell.js's renderUser() renders the account menu's "გასვლა" button as
// <button data-market="logout"> with no href (site/dist/shell.js accountLinks()/renderUser()).
// market.js used to own the document-level click handler that actually calls S.logout(); the v2
// pages don't load market.js (see SiteScripts.tsx), so this replaces just that one handler.
export function LogoutHandler() {
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-market="logout"]');
      if (!button) return;
      e.preventDefault();
      try {
        await window.MarketStore?.logout?.();
      } finally {
        window.location.href = "/account/";
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
