import { notFound } from "next/navigation";
import { Button } from "../../components/ui/Button";
export default function UIPage() {
 if(process.env.NODE_ENV === "production") notFound();
 return <main className="ma-container ma-stack"><h1>MeetAny UI</h1><p>ღილაკები იყენებს საერთო ფერებს, ზომებსა და ფოკუსის წესებს.</p><div className="ma-stack">{(["primary","secondary","accent","outline","ghost","danger","danger-quiet"] as const).map(variant=><Button key={variant} variant={variant}>{variant}</Button>)}<Button disabled>გამორთული</Button><Button loading>იტვირთება</Button><Button href="/companies/">კომპანიების ნახვა</Button></div><label className="ma-field">ტექსტი<input className="ma-input" placeholder="მაგალითი"/></label></main>;
}
