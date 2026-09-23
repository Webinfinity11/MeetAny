import { ListSkeleton } from "../components/market/Skeletons";

export default function Loading() {
  return <div className="ma-container"><ListSkeleton kind="companies" label="კომპანიები იტვირთება…" /></div>;
}
