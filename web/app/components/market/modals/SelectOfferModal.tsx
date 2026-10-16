"use client";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../Icon';
import { CompanyAvatar } from '../CompanyAvatar';
import { money } from '../../../lib/deal-client';

import styles from '../offer/OfferFlow.module.css';

/** What the confirmation shows about the offer. Compare passes its row; the request page passes what its card knows. */
export type SelectableOffer = { company: string; logoUrl?: string | null; verified?: boolean; total?: number | null; priceLabel?: string; deliveryDays?: number | null };

/** The one confirmation for choosing an offer, on Compare and on the request page alike. */
export function SelectOfferModal({ offer, request, othersCount, pending, error, onConfirm, onClose }: { offer: SelectableOffer | null; request?: { title: string }; othersCount?: number; pending: boolean; error?: string | null; onConfirm: () => void; onClose: () => void }) {
  return <Modal id="select-offer" open={!!offer} width={560} onClose={() => { if (!pending) onClose(); }} title="შეთავაზების არჩევა" lead={request?.title} actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>დაბრუნება</Button><Button loading={pending} onClick={onConfirm}><Icon name="check"/>შეთავაზების არჩევა</Button></>}>
    {offer ? <><div className={styles.selection}>
      <div className={styles.selectionIdentity}><CompanyAvatar name={offer.company} logoUrl={offer.logoUrl}/><div className={styles.selectionCompany}><strong>{offer.company}</strong>{offer.verified ? <Badge status="success">ვერიფიცირებული</Badge> : null}</div></div>
      <div className={styles.selectionTerms}><strong>{offer.priceLabel || money(offer.total)}</strong><span>{offer.deliveryDays == null ? 'ვადა დასაზუსტებელია' : `შესრულება ${offer.deliveryDays} დღეში`}</span></div>
    </div>
    <ul className={styles.outcomes}><li><Icon name="lock"/><span>ერთმანეთის ტელეფონსა და ელფოსტას დაინახავთ.</span></li>{othersCount ? <li><Icon name="inbox"/><span>დანარჩენი {othersCount} შეთავაზება მიიღებს სტატუსს „არ შეირჩა“.</span></li> : null}<li><Icon name="ban"/><span>მოთხოვნა ახალ შეთავაზებებს აღარ მიიღებს.</span></li><li><Icon name="message-square"/><span>პირობებს მომწოდებელთან გარიგების გვერდზე შეათანხმებთ.</span></li></ul>
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}</> : null}
  </Modal>;
}
