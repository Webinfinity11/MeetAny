"use client";

import { SelectOfferModal, type SelectableOffer } from "./modals/SelectOfferModal";

/** The request page's entry to the shared offer-choice confirmation. Pass `offer` for the price and delivery line. */
export function ChooseOfferSheet({ open, companyName, offer, request, othersCount, pending, error, onConfirm, onCancel }: {
  open: boolean;
  companyName: string;
  offer?: Omit<SelectableOffer, "company">;
  request?: { title: string };
  othersCount?: number;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <SelectOfferModal offer={open ? { ...offer, company: companyName } : null} request={request} othersCount={othersCount} pending={pending} error={error} onConfirm={onConfirm} onClose={onCancel}/>;
}
