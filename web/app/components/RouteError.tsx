"use client";

import { Button } from "./ui/Button";
import { useEffect } from "react";
import { StatusPage } from "./StatusPage";

// Body of every route group's error.tsx: renders inside that group's layout, so the header and
// footer stay. retry() re-renders the segment; the link leaves it.
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage eyebrow="შეცდომა" title="გვერდი ვერ ჩაიტვირთა" text="სცადეთ ხელახლა ან დაბრუნდით მთავარ გვერდზე.">
      <Button onClick={() => retry()}>
        ხელახლა ცდა
      </Button>
      <Button variant="secondary" href="/">
        მთავარზე დაბრუნება
      </Button>
    </StatusPage>
  );
}
