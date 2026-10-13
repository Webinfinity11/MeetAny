"use client";
import { useId, useState } from "react";
import type { Store } from "../../lib/market-client";
import { adminErrorMessage } from "../../lib/use-admin-data";
import styles from "./admin-edit.module.css";
import { Button } from "../ui/Button";

export function AdminIssueComment({store, issueId, onSaved}: {store: Store; issueId: string; onSaved?: () => void}) {
  const id = useId();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return <form className={styles.form} onSubmit={async event => {
    event.preventDefault(); if (pending) return;
    setPending(true); setError(null); setSent(false);
    try { await store.mutateRpc("admin_comment_deal_issue", {p_issue_id: issueId, p_body: body.trim()}); setBody(""); setSent(true); onSaved?.(); }
    catch (err) { setError(adminErrorMessage(err)); }
    finally { setPending(false); }
  }}>
    <div className={styles.field}><label htmlFor={id}>ადმინისტრაციის კომენტარი</label><textarea id={id} className="ma-textarea" required minLength={3} maxLength={1000} value={body} disabled={pending} onChange={event => setBody(event.target.value)}/><small>3–1000 სიმბოლო. კომენტარს გარიგების ორივე მხარე ნახავს.</small></div>
    {error ? <p role="alert" className="ma-field__error">{error}</p> : null}
    {sent ? <p role="status">კომენტარი გაიგზავნა.</p> : null}
    <Button type="submit" loading={pending} disabled={body.trim().length < 3}>კომენტარის გაგზავნა</Button>
  </form>;
}
