"use client";

import { useRef, useState } from "react";
import { trapDialogFocus } from "../ui/dialog-focus";
import { Icon } from "../Icon";
import styles from "./company/CompanyProfile.module.css";

/** Compact thumbnails; the final tile opens the remaining photos in the viewer. */
export function CompanyGallery({ photos: all, name }: { photos: string[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  // A photo that fails to load is dropped rather than shown as a broken tile.
  const [failed, setFailed] = useState<string[]>([]);
  const photos = all.filter(src => !failed.includes(src));
  if (!photos.length) return null;
  const shown = photos.slice(0, 5);
  const extra = photos.length - shown.length;
  const open = (i: number) => { setIndex(i); dialog.current?.showModal(); };
  const step = (d: number) => setIndex(i => (i + d + photos.length) % photos.length);
  return (
    <>
      <div className={styles.gallery}>
        {shown.map((src, i) => (
          <button key={src + i} type="button" className={styles.galleryTile} onClick={() => open(i)} aria-label={`${name} — ფოტო ${i + 1} / ${photos.length}`}>
            <img src={src} alt="" loading={i ? "lazy" : "eager"} onError={() => setFailed(f => [...f, src])} />
            {i === shown.length - 1 && extra > 0 ? <span className="company-gallery__more">+{extra}</span> : null}
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="company-viewer" aria-label={`${name} — ფოტოები`} onKeyDown={e => { trapDialogFocus(e); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }} onClick={e => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <img src={photos[index]} alt={`${name} — ფოტო ${index + 1}`} />
        <p className="company-viewer__count">{index + 1} / {photos.length}</p>
        <button type="button" className="company-viewer__close" aria-label="დახურვა" onClick={() => dialog.current?.close()}><Icon name="x" /></button>
        <button type="button" className="company-viewer__nav company-viewer__nav--prev" aria-label="წინა" onClick={() => step(-1)}><Icon name="chevron-left" /></button>
        <button type="button" className="company-viewer__nav company-viewer__nav--next" aria-label="შემდეგი" onClick={() => step(1)}><Icon name="chevron-right" /></button>
      </dialog>
    </>
  );
}
