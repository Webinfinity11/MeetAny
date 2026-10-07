import { connection } from "next/server";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { PostRequestPage } from "../../../components/market/PostRequestPage";

// No Suspense boundary: see (requests)/requests/page.tsx.
export default async function RequestsNewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return <PostRequestPage initial={initial} />;
}
