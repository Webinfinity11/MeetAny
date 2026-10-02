/** One bounded server snapshot. Queue totals include records beyond the six returned items. */
export type AdminOverviewStats = {
  adminApiVersion: number;
  adminRevision: string;
  hidden: number;
  blocked: number;
  users: number;
  companies: number;
  verified: number;
  open: number;
  requests: number;
  offers: number;
  chosen: number;
};
export type AdminOverviewRequest = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  offerCount: number;
  daysLeft: number;
  expiresAt?: string;
};
export type AdminOverviewData = {
  stats: AdminOverviewStats;
  activity: { day: string; requests: number; registrations: number }[];
  pending: { total: number; items: { id: string; name: string; company: string | null; industry: string | null }[] };
  unanswered: { total: number; items: AdminOverviewRequest[] };
  expiring: { total: number; items: AdminOverviewRequest[] };
  generatedAt: string;
};
