"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../ui/Button";
import { ConfirmSheet } from "../../ui/ConfirmSheet";
import type { useUnsavedGuard } from "../../../lib/use-unsaved-draft";

export function useSavedTime() {
  const [savedAt, setSavedAt] = useState("");
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(""), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);
  return { savedAt, markSaved: () => setSavedAt(new Date().toISOString()), clearSaved: () => setSavedAt("") };
}

export function AccountSectionFooter({ dirty, pending, disabled, savedAt, error, errorId, children }: {
  dirty?: boolean; pending?: boolean; disabled?: boolean; savedAt?: string; error?: string | null; errorId?: string; children?: ReactNode;
}) {
  const message = error || (pending ? "ინახება…" : dirty ? "შეუნახავი ცვლილებები" : savedAt ? `შენახულია · ${new Date(savedAt).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}` : "");
  return <div className="account-section__footer">
    <p id={errorId} className={message ? error ? "ma-field__error" : "account-section__status" : "ma-sr-only"} role={error ? "alert" : "status"}>
      {message}
    </p>
    {children || <Button variant={dirty ? "primary" : "secondary"} type="submit" disabled={!dirty || pending || disabled} loading={pending}>შენახვა</Button>}
  </div>;
}

export function ProfileBlock({ id, title, description, dirty, pending, locked, savedAt, error, onSave, children }: {
  id: string; title: string; description?: string; dirty: boolean; pending: boolean; locked?: boolean; savedAt?: string; error?: string;
  onSave: () => Promise<boolean>; children: ReactNode;
}) {
  return <section id={`profile-${id}`} className="account-section account-profile-block" aria-labelledby={`profile-${id}-title`}>
    <header className="account-section__heading"><h2 id={`profile-${id}-title`} className="account-section__title">{title}</h2>{description && <p className="account-hint">{description}</p>}</header>
    <form className="ma-form" onSubmit={event => { event.preventDefault(); void onSave(); }} noValidate>
      <fieldset className="account-block-fields" disabled={pending || locked}>{children}</fieldset>
      <AccountSectionFooter dirty={dirty} pending={pending} disabled={locked} savedAt={savedAt} error={error}/>
    </form>
  </section>;
}

export function UnsavedSheet({ guard, pending, error, save, id = "profile-unsaved" }: {
  guard: ReturnType<typeof useUnsavedGuard>; pending: boolean; error: string | null; save: () => Promise<boolean>; id?: string;
}) {
  return <ConfirmSheet id={id} open={guard.open} title="შეუნახავი ცვლილებები" confirmLabel="შეინახეთ" pendingLabel="ინახება…" cancelLabel="დარჩით" pending={pending} error={error} onCancel={guard.stay} onConfirm={async () => { if (await save()) guard.leave(); }}>
    <p>გასვლამდე შეინახეთ ცვლილებები ან უარყავით ისინი.</p>
    <Button variant="ghost" disabled={pending} onClick={guard.leave}>უარყავით</Button>
  </ConfirmSheet>;
}
