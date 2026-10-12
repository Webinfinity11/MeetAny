import type { KeyboardEvent } from "react";

/** Keep keyboard focus inside a modal, including the browser chrome boundary. */
export function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]'))
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled,[hidden],[inert]') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
  const first = controls[0], last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); dialog.focus(); }
  else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
}

/**
 * Close a <dialog> after its leave animation: sets data-closing (CSS plays --motion-overlay-out), then
 * dialog.close(). A timer backs up animationend, so reduced motion and missing keyframes still close.
 * Returns a cancel function for when the dialog is reopened mid-way.
 */
export function closeDialogWithMotion(dialog: HTMLDialogElement, done?: () => void): () => void {
  if (!dialog.open) { done?.(); return () => {}; }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    dialog.removeEventListener("animationend", onEnd);
    delete dialog.dataset.closing;
    if (dialog.open) dialog.close();
    done?.();
  };
  const onEnd = (event: AnimationEvent) => { if (event.target === dialog && !event.pseudoElement) finish(); };
  dialog.dataset.closing = "";
  const duration = parseFloat(getComputedStyle(dialog).animationDuration) || 0;
  const timer = setTimeout(finish, Math.min(400, duration * 1000 + 40));
  dialog.addEventListener("animationend", onEnd);
  return () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    dialog.removeEventListener("animationend", onEnd);
    delete dialog.dataset.closing;
  };
}
