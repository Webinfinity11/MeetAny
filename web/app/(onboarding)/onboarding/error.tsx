'use client';
import { Button } from '../../components/ui/Button';
export default function Error({ retry }: { retry: () => void }) {
  return <main className="ma-page"><h1>გვერდი ვერ ჩაიტვირთა</h1><p>მონაცემები თავიდან ჩატვირთეთ.</p><Button onClick={retry}>ხელახლა ცდა</Button></main>;
}
