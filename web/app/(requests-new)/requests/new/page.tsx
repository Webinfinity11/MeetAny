import { connection } from "next/server";
import { PostRequestPage } from "../../../components/market/PostRequestPage";

// No Suspense boundary: see (requests)/requests/page.tsx.
export default async function RequestsNewPage() {
  await connection();
  // The draft form uses local categories and text. Catalog/auth reads start in
  // the browser without blocking this page's first paint.
  return <PostRequestPage />;
}
