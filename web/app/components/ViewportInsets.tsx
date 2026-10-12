"use client";
import { useEffect } from "react";

// --keyboard-inset: how much of the layout viewport the on-screen keyboard covers (iOS keeps the
// layout viewport and shrinks only the visual one). .ma-form-bar sits on it, so submit stays visible.
export function ViewportInsets() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Pinch zoom also shrinks the visual viewport; only an unzoomed shrink is a keyboard.
        const inset = Math.abs(viewport.scale - 1) > 0.01 ? 0 : Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
        if (inset > 0) root.style.setProperty("--keyboard-inset", `${inset}px`);
        else root.style.removeProperty("--keyboard-inset");
      });
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update); root.style.removeProperty("--keyboard-inset"); };
  }, []);
  return null;
}
