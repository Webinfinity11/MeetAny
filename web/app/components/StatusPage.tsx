import Link from "next/link";
import styles from "./StatusPage.module.css";

export { styles as statusPageStyles };

// Shared body of the 404 and error pages: eyebrow, mtavruli title, one sentence, one way on.
export function StatusPage({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={styles.page} aria-labelledby="status-title">
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 id="status-title" className={styles.title}>
        {title}
      </h1>
      <p className={styles.text}>{text}</p>
      <div className={styles.actions}>{children}</div>
    </section>
  );
}

export function NotFoundBody() {
  return (
    <StatusPage eyebrow="შეცდომა 404" title="გვერდი ვერ მოიძებნა" text="ბმული მოძველებულია ან გვერდი წაიშალა.">
      <Link className={styles.button} href="/">
        მთავარზე დაბრუნება
      </Link>
    </StatusPage>
  );
}
