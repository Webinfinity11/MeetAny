"use client";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../Icon';
import { CompanyAvatar } from '../CompanyAvatar';
import { money, type ComparedOffer } from '../../../lib/deal-client';
import styles from '../offer/OfferFlow.module.css';

export function SelectOfferModal({ offer, request, othersCount, pending, onConfirm, onClose }: { offer: ComparedOffer | null; request?: { title: string }; othersCount: number; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal open={!!offer} onClose={() => { if (!pending) onClose(); }} title={`აირჩიოთ ${offer?.company || 'კომპანია'}?`} lead="არჩევის შემდეგ გარიგება გადავა „დეტალების განხილვაზე“." actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>გაუქმება</Button><Button loading={pending} onClick={onConfirm}><Icon name="check"/>არჩევა</Button></>}>
    {offer ? <><div className={styles.selection}><CompanyAvatar name={offer.company}/><div><strong>{offer.company}</strong>{offer.verified ? <Badge status="success">ვერიფიცირებული</Badge> : null}<p>{request?.title}</p></div><div><strong>{money(offer.total_gel)}</strong><p>{offer.delivery_days == null ? 'ვადა დასაზუსტებელია' : `${offer.delivery_days} დღე`}</p></div></div>
    <ul className={styles.outcomes}><li><Icon name="lock"/><span><strong>კონტაქტი გაიხსნება</strong> — ორივე მხარე დაინახავს ტელეფონს და ელფოსტას.</span></li><li><Icon name="inbox"/><span>დანარჩენი {othersCount} შეთავაზება გადავა „არ შეირჩა“ სტატუსში.</span></li><li><Icon name="ban"/><span>მოთხოვნა დაიხურება ახალი შეთავაზებებისთვის.</span></li></ul></> : null}
  </Modal>;
}
