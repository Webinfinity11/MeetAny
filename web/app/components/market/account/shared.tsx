"use client";
import { optimizable } from "../../../lib/image";
import Image from "next/image";
import { useState } from "react";
import styles from "./account.module.css";
import { Badge, type BadgeProps } from "../../ui/Badge";
import { Icon } from "../../Icon";
import { categoryPhoto, currentCategory } from "../../../lib/categories";
import { money } from "../../../lib/format";
import { offerStatusLabel } from "../../../lib/deal-client";
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
  accountIntent?: "buy" | "sell" | "both";
  onboardingCompletedAt?: string | null;
  verificationDocumentsStatus?: "not_submitted" | "pending" | "approved" | "rejected";
};

export type RequestItem = { chosenOfferId?: string | null; id: string; ownerId: string; title: string; category: string; city: string; createdAt: string; expiresAt: string; hidden: boolean; photo?: string | null; quantity?: number | null; unit?: string | null };
export type OfferItem = { id: string; companyUserId: string; requestId: string; status: string; createdAt: string; updatedAt?: string; viewedAt?: string | null; paymentTerms?: string | null; price?: number | null; priceType?: string; deliveryDays?: number | null; vatIncluded?: boolean; deliveryIncluded?: boolean };
export type Tab = "deals" | "overview" | "opportunities" | "requests" | "offers" | "saved" | "messages" | "notifications" | "profile" | "business";
export type NavItem = { key: Tab; label: string; icon: string; count?: number | null; href?: string };
export const requestHref = (id: string) => `/requests/view/?id=${encodeURIComponent(id)}`;
/** A sent offer the buyer has opened reads as "viewed"; the rest come from the shared offer status labels. */
export const offerLabel = (status: string, viewedAt?: string | null) => offerStatusLabel(status === "sent" && viewedAt ? "viewed" : status);
export const amount = (offer: OfferItem) => offer.price == null || offer.priceType === "negotiable" ? "შეთანხმებით" : `${money(offer.price)}${offer.priceType === "unit" ? " / ერთეული" : ""}`;
export function readSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("meetany.seen") || "{}") || {}; } catch { return {}; }
}
export function Status({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <Badge className={styles.status} status={(tone === "open" ? "success" : tone === "chosen" ? "info" : ["success","warning","info","danger","dark","muted"].includes(tone) ? tone : "neutral") as BadgeProps["status"]}>{children}</Badge>;
}
export function RequestPhoto({ request }: { request?: RequestItem | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = request?.photo || `/assets/photos/${categoryPhoto[currentCategory(request?.category || "other")] || "workshop-banner.jpg"}`;
  return photo !== failed ? <Image unoptimized={!optimizable(photo)} className="account-item-photo" src={photo} alt="" width={80} height={56} onError={() => setFailed(photo)} /> : <span className="account-item-photo account-photo-fallback"><Icon name="file-text"/></span>;
}
