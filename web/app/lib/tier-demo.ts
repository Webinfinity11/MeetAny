// PROTOTYPE ONLY: title-based demo tiers; no database or paid-status changes.
export type RequestTier = "vip" | "top";

const demoTitles: Record<RequestTier, readonly string[]> = {
  vip: ["საქონლის გადაზიდვა თბილისიდან ქუთაისში", "სასტუმროს საერთო სივრცის გენერალური დასუფთავება"],
  top: ["მაღაზიის 120 კვ.მ კედლების შეღებვა", "კაფის მენიუსა და შეკვეთების მარტივი ვებგვერდი", "სასტუმროს 12 ნომრისთვის დამაბნელებელი ფარდები"],
};

export function requestDemoTier(title: string): RequestTier | undefined {
  if (demoTitles.vip.some(fragment => title.includes(fragment))) return "vip";
  if (demoTitles.top.some(fragment => title.includes(fragment))) return "top";
}
