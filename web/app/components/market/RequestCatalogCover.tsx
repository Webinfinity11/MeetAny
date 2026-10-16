import Image from "next/image";
import { requestCoverPhoto } from "../../lib/request-cover";
import styles from "./RequestCatalogCover.module.css";

/** A labelled category photograph for requests without an uploaded, usable image. */
export function RequestCatalogCover({ category }: { category: string }) {
  return <span className={styles.cover} data-request-cover title="თემატური ფოტო">
    <Image src={requestCoverPhoto(category)} alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 400px" loading="lazy" />
    <span className={styles.note}>თემატური ფოტო</span>
  </span>;
}
