"use client";

import { ConfirmSheet } from "../ui/ConfirmSheet";

export function ChooseOfferSheet({ open, companyName, pending, error, onConfirm, onCancel }: {
  open: boolean;
  companyName: string;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmSheet id="choose" open={open} title="შეთავაზების არჩევა" confirmLabel="შეთავაზების არჩევა" pendingLabel="ირჩევა…" pending={pending} error={error} onConfirm={onConfirm} onCancel={onCancel}>
      <p>
        არჩევის შემდეგ <b>{companyName}</b>-ს გაეზიარება შენი საკონტაქტო ინფორმაცია.
        მოთხოვნა ახალ შეთავაზებებს აღარ მიიღებს, დანარჩენ შეთავაზებებს მიენიჭება სტატუსი „არ აირჩიეს“.
        საბოლოო პირობებს კომპანიასთან შეათანხმებ.
      </p>
    </ConfirmSheet>
  );
}
