"use client";
import { useCallback, useState } from "react";
import { useBusinessResource } from "../../lib/business-client";
import type { Store } from "../../lib/market-client";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { adminDateTime } from "../../lib/admin-helpers";
import type { AdminReport } from "./AdminReports";
import type { AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";
type Page = {items: {id:string;body:string;sender_id:string;created_at:string}[];nextCursor?:unknown;hasMore?:boolean};
export function AdminReportContent({store, report, onClose, onOpen}: {store:Store;report:AdminReport;onClose:()=>void;onOpen:(target:AdminTarget)=>void}) {
  const [cursor,setCursor] = useState<unknown>(null);
  const read = useCallback(() => store.callRpc("admin_conversation_messages",{p_conversation_id:report.target_id,p_cursor:cursor}) as Promise<Page>,[store,report.target_id,cursor]);
  const resource = useBusinessResource(report.target_kind === "conversation" ? read : undefined,report.id);
  return <Sheet open title={report.target_kind === "review" ? "შეფასება" : "მიმოწერა"} onClose={onClose}>
    <h3>{report.target_label}</h3>
    {report.target_kind === "review" ? <><p className={styles.detailText}>{report.target_body}</p><Button variant="secondary" onClick={() => {onOpen({kind:"user",id:report.context_id!});onClose();}}>კომპანიის დეტალი</Button></> : resource.error ? <div role="alert"><p>მიმოწერა ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={resource.reload}>ხელახლა ცდა</Button></div> : !resource.data ? <p role="status">იტვირთება…</p> : <>
      <ul className={styles.issueList}>{[...resource.data.items].reverse().map(m => <li key={m.id}><strong>{m.sender_id===report.reporter_id?report.reporter_name:"მეორე მხარე"}</strong><p className={styles.detailText}>{m.body}</p><small>{adminDateTime(m.created_at)}</small></li>)}</ul>
      {resource.data.hasMore ? <Button variant="secondary" onClick={() => setCursor(resource.data?.nextCursor)}>ძველი შეტყობინებები</Button> : null}
    </>}
  </Sheet>;
}
