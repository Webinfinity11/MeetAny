"use client";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Icon } from '../../Icon';
import styles from '../offer/OfferFlow.module.css';
export function OfferSentModal({ open, buyer, onClose }: { open: boolean; buyer: string; onClose: () => void }) {
  return <Modal open={open} onClose={onClose} icon="circle-check" tone="success" title="შეთავაზება გაიგზავნა" lead={`${buyer}-ს ეცნობა. სტატუსის ცვლილებას შეტყობინებით მიიღებთ.`} actions={<><Button variant="secondary" href="/account/?tab=offers">ჩემი შეთავაზებები</Button><Button href="/matching/">სხვა შესაძლებლობები</Button></>}>
    <ol className={styles.sentSteps} aria-label="შეთავაზების შემდგომი გზა"><li aria-current="step"><strong>● მოლოდინში</strong><small>ახლა</small></li><li><strong>ნანახი</strong><small>მყიდველი გახსნის</small></li><li><strong>არჩეული</strong><small>კონტაქტი გაიხსნება</small></li></ol>
    <p className={styles.editHint}><Icon name="pencil"/>შეგიძლიათ შეცვალოთ, სანამ მყიდველი აირჩევს.</p>
  </Modal>;
}
