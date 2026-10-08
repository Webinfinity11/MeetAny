"use client";
import Image from "next/image";
import { useState } from "react";
import { categoryPhoto, currentCategory } from "../../../lib/categories";
export type AnyUser = {
  id: string;
  role: string;
  name: string;
  company?: string;
  logoUrl?: string | null;
  gallery?: string[];
  phone: string;
  email: string;
  city: string;
  industry?: string;
  verified: boolean;
  blocked: boolean;
  about?: string;
  offers?: string[];
  seeks?: string[];
  serviceCities?: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type RequestItem = { chosenOfferId?: string | null; id: string; ownerId: string; title: string; category: string; city: string; createdAt: string; expiresAt: string; hidden: boolean; photo?: string | null; quantity?: number | null; unit?: string | null };
export type OfferItem = { id: string; companyUserId: string; requestId: string; status: string; createdAt: string; updatedAt?: string; paymentTerms?: string | null; price?: number | null; priceType?: string; deliveryDays?: number | null; vatIncluded?: boolean; deliveryIncluded?: boolean };
export type Tab = "deals" | "overview" | "opportunities" | "requests" | "offers" | "saved" | "messages" | "notifications" | "profile" | "business";
export type NavItem = { key: Tab; label: string; icon: string; count?: number | null };
export const requestHref = (id: string) => `/requests/view/?id=${encodeURIComponent(id)}`;
export const offerLabel = (status: string) => status === "chosen" ? "არჩეული" : status === "declined" ? "უარყოფილი" : "გაგზავნილი";
export const amount = (offer: OfferItem) => offer.price == null || offer.priceType === "negotiable" ? "შეთანხმებით" : `${new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 2 }).format(offer.price)} ₾${offer.priceType === "unit" ? " / ერთეული" : ""}`;
export function readSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("meetany.seen") || "{}") || {}; } catch { return {}; }
}
export function Status({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className="account-status" data-tone={tone}>{children}</span>;
}
export function RequestPhoto({ request }: { request?: RequestItem | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = request?.photo || `/assets/photos/${categoryPhoto[currentCategory(request?.category || "other")] || "workshop-banner.jpg"}`;
  return photo !== failed ? <Image unoptimized className="account-item-photo" src={photo} alt="" width={80} height={56} onError={() => setFailed(photo)} /> : null;
}
