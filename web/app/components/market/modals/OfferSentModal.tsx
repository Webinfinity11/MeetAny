"use client";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
export function OfferSentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Modal open={open} onClose={onClose} icon="circle-check" tone="success" title="შეთავაზება გაიგზავნა" lead="მყიდველის პასუხს შეტყობინებით მიიღებთ." actions={<><Button variant="secondary" href="/matching/">სხვა მოთხოვნები</Button><Button href="/account/?tab=offers">ჩემი შეთავაზებები</Button></>}/>;
}
