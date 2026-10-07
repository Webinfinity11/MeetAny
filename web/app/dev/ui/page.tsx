import { notFound } from "next/navigation";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export default function UIPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="ma-container ma-stack">
    <h1>MeetAny UI</h1>
    <p>ღილაკები და სტატუსის ნიშნები იყენებს საერთო ფერებს, ზომებსა და ფოკუსის წესებს.</p>
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
  </main>;
}
