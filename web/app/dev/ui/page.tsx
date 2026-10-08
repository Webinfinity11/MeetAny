"use client";
import { useState } from "react";
import { Modal, type ModalTone } from "../../components/ui/Modal";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { EmptyState } from "../../components/ui/Structure";
import { SkeletonGrid } from "../../components/market/Skeletons";
import { toast, type ToastMessage } from "../../components/Toasts";
import { notFound } from "next/navigation";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/Icon";
import toastStyles from "../../components/Toasts.module.css";

export default function UIPage() {
  const [modal, setModal] = useState<ModalTone | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="ma-container ma-stack">
    <h1>MeetAny UI</h1>
    <p>ღილაკები და სტატუსის ნიშნები იყენებს საერთო ფერებს, ზომებსა და ფოკუსის წესებს.</p>
    <h2>მოდალური ფანჯრები</h2>
    <div>{(["neutral", "success", "warning", "danger", "info"] as const).map(tone => <Button key={tone} variant="secondary" onClick={() => setModal(tone)}>Modal {tone}</Button>)}<Button variant="secondary" onClick={() => setConfirm(true)}>დასტურის ფანჯარა</Button></div>
    <Modal open={modal !== null} onClose={() => setModal(null)} title="შეთავაზების გაგზავნა" lead="გადაამოწმეთ დეტალები გაგზავნამდე." tone={modal || "neutral"} icon={{ neutral: "file-text", success: "circle-check", warning: "triangle-alert", danger: "circle-alert", info: "info" }[modal || "neutral"]}
      actions={<><Button variant="secondary" onClick={() => setModal(null)}>გაუქმება</Button><Button onClick={() => { setModal(null); toast("შეთავაზება გაიგზავნა"); }}>გაგზავნა</Button></>}><label className="ma-field">კომენტარი<input className="ma-input" placeholder="დამატებითი ინფორმაცია" /></label></Modal>
    <ConfirmSheet id="ui-confirm" open={confirm} onCancel={() => setConfirm(false)} title="მოთხოვნის დახურვა" confirmLabel="დახურვის დადასტურება" pendingLabel="იხურება" danger pending={false} onConfirm={() => { setConfirm(false); toast("მოთხოვნა დაიხურა"); }}>მოთხოვნაზე ახალი შეთავაზებები აღარ მოვა.</ConfirmSheet>
    <h2>Toast — მოქმედების დადასტურება</h2>
    <div className="ui-preview-grid ui-toast-grid">{([
      { title: "შეთავაზება გაიგზავნა", sub: "Coffee House Georgia-ს ეცნობა" },
      { title: "შენახულია", sub: "შენახულ შესაძლებლობებში", action: { label: "გაუქმება", onClick: () => toast("შენახვა გაუქმდა") } },
      { tone: "info", title: "ახალი შეთავაზება · ₾2,150", sub: "Print Solutions Georgia", action: { label: "ნახვა", onClick: () => setModal("info") } },
      { tone: "warning", title: "მოთხოვნის ვადა 2 დღეში იწურება", action: { label: "გაგრძელება", onClick: () => setModal("warning") } },
      { tone: "danger", title: "ფაილი 10 MB-ზე დიდია", sub: "ატვირთეთ PDF, JPG ან PNG" },
      { title: "მონახაზი შენახულია" },
    ] satisfies ToastMessage[]).map((message: ToastMessage) => <div key={message.title} className={toastStyles.toast} data-tone={message.tone || "success"}>
      <Icon name={{ success: "circle-check", info: "info", warning: "triangle-alert", danger: "circle-alert" }[message.tone || "success"]} className={toastStyles.icon}/>
      <div className={toastStyles.copy}><p className={toastStyles.title}>{message.title}</p>{message.sub ? <p className={toastStyles.sub}>{message.sub}</p> : null}</div>
      {message.action ? <button type="button" className={toastStyles.action} onClick={message.action.onClick}>{message.action.label}</button> : null}
    </div>)}</div>
    <h2>ცარიელი ეკრანები</h2>
    <div className="ui-preview-grid">
    <EmptyState icon="inbox" title="შეთავაზებები ჯერ არაა" text="მოთხოვნა 15 მომწოდებელს ეცნობა. პირველი შეთავაზებები ჩვეულებრივ 24 საათში მოდის." action={<Button variant="secondary" onClick={() => setModal("info")}>მოთხოვნის ნახვა</Button>} />
    <EmptyState icon="file-text" title="მოთხოვნები არ გაქვთ" text="აღწერეთ, რა გჭირდებათ — შესაბამისი კომპანიები შეთავაზებებს გამოგიგზავნიან." action={<Button onClick={() => setModal("neutral")}>მოთხოვნის განთავსება</Button>} />
    <EmptyState icon="search" title="ვერაფერი მოიძებნა" text="შეცვალეთ ფილტრები ან ძიების სიტყვა. „ჭიქები“-ს ნაცვლად სცადეთ „შეფუთვა“." action={<Button variant="secondary" onClick={() => toast("ფილტრები გასუფთავდა")}>ფილტრების გასუფთავება</Button>} />
    <EmptyState icon="message-square" title="მესიჯები ჯერ არაა" text="ჩატი იხსნება, როცა შეთავაზებას გაგზავნით ან მიიღებთ." />
    </div>
    <h2>ჩატვირთვა</h2><SkeletonGrid count={3} columns={3} />
    <h2>ღილაკები</h2>
    <div className="ma-stack">
      {(["base", "primary", "secondary", "accent", "tint", "outline", "ghost", "danger", "danger-quiet"] as const).map(variant => <Button key={variant} variant={variant}>{variant}</Button>)}
      <Button size="sm">პატარა</Button>
      <Button size="lg">დიდი</Button>
      <Button disabled>გამორთული</Button>
      <Button loading>იტვირთება</Button>
      <Button href="/companies/">კომპანიების ნახვა</Button>
    </div>
    <h2>სტატუსის ნიშნები</h2>
    <div>
      {(["success", "warning", "info", "neutral", "danger", "dark", "muted"] as const).map(status => <Badge key={status} status={status}>{status}</Badge>)}
    </div>
    <div><Badge tone="new">ახალი</Badge> <Badge tone="vip">VIP</Badge> <Badge tone="top">ტოპ</Badge></div>
    <label className="ma-field">ტექსტი<input className="ma-input" placeholder="მაგალითი" /></label>
    <style jsx>{`
      .ui-preview-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
      .ui-toast-grid { gap: var(--space-3); }
      @media (min-width: 800px) { .ui-preview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    `}</style>
  </main>;
}
