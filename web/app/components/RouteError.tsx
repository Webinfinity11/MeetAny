"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, statusPageStyles as styles } from "./StatusPage";

// Body of every route group's error.tsx: renders inside that group's layout, so the header and
// footer stay. retry() re-renders the segment; the link leaves it.
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage eyebrow="შეცდომა" title="გვერდი ვერ ჩაიტვირთა" text="რაღაც არ გამოვიდა — სცადე თავიდან ან დაბრუნდი მთავარზე.">
      <button className={styles.button} type="button" onClick={() => retry()}>
        სცადე თავიდან
      </button>
      <Link className={styles.link} href="/">
        მთავარზე დაბრუნება
      </Link>
    </StatusPage>
  );
}
