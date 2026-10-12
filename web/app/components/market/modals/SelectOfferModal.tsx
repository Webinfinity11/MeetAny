"use client";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../Icon';
import { CompanyAvatar } from '../CompanyAvatar';
import { money, type ComparedOffer } from '../../../lib/deal-client';
import styles from '../offer/OfferFlow.module.css';

export function SelectOfferModal({ offer, request, othersCount, pending, onConfirm, onClose }: { offer: ComparedOffer | null; request?: { title: string }; othersCount: number; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal open={!!offer} width={560} onClose={() => { if (!pending) onClose(); }} title="მომწოდებლის არჩევა" actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>გაუქმება</Button><Button loading={pending} onClick={onConfirm}><Icon name="check"/>არჩევა</Button></>}>
    {offer ? <><div className={styles.selection} aria-label={request?.title}>
      <div className={styles.selectionIdentity}><CompanyAvatar name={offer.company}/><div className={styles.selectionCompany}><strong>{offer.company}</strong>{offer.verified ? <Badge status="success">ვერიფიცირებული</Badge> : null}</div></div>
      <div className={styles.selectionTerms}><strong>{money(offer.total_gel)}</strong><span>{offer.delivery_days == null ? 'ვადა დასაზუსტებელია' : `${offer.delivery_days} დღე`}</span></div>
    </div>
    <ul className={styles.outcomes}><li><Icon name="lock"/><span>ორივე მხარე დაინახავს ტელეფონსა და ელფოსტას.</span></li>{othersCount > 0 ? <li><Icon name="inbox"/><span>დანარჩენი {othersCount} შეთავაზება — „არ შეირჩა“.</span></li> : null}<li><Icon name="ban"/><span>ახალი შეთავაზებები აღარ მიიღება.</span></li></ul></> : null}
  </Modal>;
}
