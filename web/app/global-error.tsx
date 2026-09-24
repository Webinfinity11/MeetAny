"use client";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/patterns.css";
import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, statusPageStyles as styles } from "./components/StatusPage";

// Only when a root layout itself fails: replaces the whole document, so no Header/Footer
// (they may be what broke). Each group's error.tsx covers everything below its layout.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ka">
      <body className={styles.bare}>
        <title>შეცდომა — MeetAny</title>
        <main>
          <StatusPage eyebrow="შეცდომა" title="საიტი ვერ ჩაიტვირთა" text="რაღაც არ გამოვიდა — სცადე თავიდან ან დაბრუნდი მთავარზე.">
            <button className={styles.button} type="button" onClick={() => retry()}>
              სცადე თავიდან
            </button>
            <Link className={styles.link} href="/">
              მთავარზე დაბრუნება
            </Link>
          </StatusPage>
        </main>
      </body>
    </html>
  );
}
