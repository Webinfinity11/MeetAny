"use client";

import { useId, useMemo, useRef, useState } from "react";
import { parseProductCsv, parseProductRows, productKey, PRODUCT_HEADERS, PRODUCT_UNITS, type ImportProduct } from "../../lib/products-import";
import { businessError } from "../../lib/business-client";
import { Button } from "../ui/Button";
import { toast } from "../Toasts";
import styles from "./company/CompanyProfile.module.css";

export type ProductsImportProps = {
 existing: ImportProduct[];
 gallery: string[];
 /** Receives the complete merged catalog, including preserved photos; resolve only after saving. */
 onConfirm: (products: ImportProduct[]) => Promise<void>;
 disabled?: boolean;
};

export function ProductsImport({ existing, gallery, onConfirm, disabled = false }: ProductsImportProps) {
 const id = useId(), input = useRef<HTMLInputElement>(null), revision = useRef(0);
 const [rows, setRows] = useState<string[][] | null>(null), [filename, setFilename] = useState("");
 const [busy, setBusy] = useState(false), [error, setError] = useState("");
 const result = useMemo(() => rows ? parseProductRows(rows, { existing, gallery }) : null, [rows, existing, gallery]);
 const preview = rows?.slice(1).flatMap((cells, i) => {
  if (cells.every(cell => !cell.trim())) return [];
  const row = i + 2, errors = result?.errors.filter(error => error.row === row) || [];
  const update = existing.some(product => productKey(product) === productKey({ name: cells[1] || "", code: cells[0] }));
  return [{ cells, row, errors, update }];
 }) || [];
 const added = preview.filter(row => !row.errors.length && !row.update).length;
 const updated = preview.filter(row => !row.errors.length && row.update).length;
 async function read(file?: File) {
  if (!file) return;
  const current = ++revision.current;
  setBusy(true); setError(""); setRows(null); setFilename(file.name);
  try {
   if (file.size > 2 * 1024 * 1024) throw new Error("ფაილის მაქსიმალური ზომაა 2 მბ.");
   let parsed: string[][];
   if (/\.csv$/i.test(file.name)) parsed = parseProductCsv(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()));
   else if (/\.xlsx$/i.test(file.name)) {
    // Same cookie-backed Neon JWT endpoint used by market-store; never persist the token.
    const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL?.replace(/\/+$/, "");
    if (!authUrl) throw new Error("ავტორიზაცია დროებით მიუწვდომელია.");
    const auth = await fetch(`${authUrl}/token`, { credentials: "include", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
    const session = await auth.json();
    if (!auth.ok || !session.token) throw new Error("ფაილის ასატვირთად შედით ანგარიშში.");
    const response = await fetch("/api/products-import", { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: file, signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "ფაილი ვერ აიტვირთა.");
    parsed = data.rows;
   } else throw new Error("აირჩიეთ .xlsx ან UTF-8 .csv ფაილი.");
   if (current === revision.current) setRows(parsed);
  } catch (err) {
   if (current === revision.current) setError(err instanceof Error && /[ა-ჰ]/.test(err.message) ? err.message : "ფაილი ვერ წაიკითხა. გამოიყენეთ XLSX შაბლონი ან UTF-8 CSV და სცადეთ ხელახლა.");
  } finally { if (current === revision.current) setBusy(false); }
 }
 return <section className={styles.productsImport} aria-labelledby={`${id}-title`}>
  <h3 id={`${id}-title`}>პროდუქტების იმპორტი</h3>
  <p className={styles.productsHelp}>ჩამოტვირთეთ შაბლონი, შეცვალეთ ნიმუშები თქვენი პროდუქტებით და ატვირთეთ. ფასი და ფოტო არასავალდებულოა; ფოტო იმპორტით არ ემატება.</p>
  <p className={styles.productsHelp}>ერთეულები: {Object.values(PRODUCT_UNITS).join(" / ")}. მაქსიმუმ 100 პროდუქტი, ფაილი — 2 მბ / 500 რიგი.</p>
  <div className={styles.productsEditorActions}>
   <Button href="/templates/meetany-products.xlsx" download variant="secondary">შაბლონის ჩამოტვირთვა (.xlsx)</Button>
   <Button variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>ფაილის არჩევა</Button>
   <input ref={input} id={`${id}-file`} type="file" accept=".xlsx,.csv" hidden aria-label="პროდუქტების ფაილი" disabled={disabled || busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }}/>
  </div>
  {busy ? <p role="status">მიმდინარეობს დამუშავება…</p> : null}
  {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
  {result ? <>
   <p className={styles.productsHelp}>{filename}</p>
   <p role="status">{added} დაემატება · {updated} განახლდება · {result.errors.length} შეცდომა</p>
   {result.errors.filter(error => error.row <= 1).map((error, i) => <p key={i} className="ma-field__error" role="alert">{error.row ? `რიგი ${error.row}: ` : ""}{error.message}</p>)}
   <div className={styles.productsImportTable} role="region" aria-label="იმპორტის წინასწარი ნახვა" tabIndex={0}>
    <table><caption>ატვირთული პროდუქტების წინასწარი ნახვა</caption><thead><tr><th scope="col">რიგი / სტატუსი</th>{PRODUCT_HEADERS.map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
    <tbody>{preview.map(({ cells, row, errors, update }) => <tr key={row}>
     <th scope="row">{errors.length ? errors.map((error, i) => <p key={i} className="ma-field__error">რიგი {row}: {error.message}</p>) : <span className={styles.productImportValid}>✓ რიგი {row}: {update ? "განახლდება" : "დაემატება"}</span>}</th>
     {PRODUCT_HEADERS.map((_, i) => <td key={i}>{cells[i] || "—"}</td>)}
    </tr>)}</tbody></table>
   </div>
   <div className={styles.productsEditorActions}>
    <Button loading={busy} disabled={disabled} onClick={async () => {
     if (!preview.length || result.errors.length) { setError(result.errors.length ? "გაასწორეთ მითითებული შეცდომები და ხელახლა ატვირთეთ ფაილი." : "ფაილში პროდუქტები არ არის."); return; }
     setError(""); setBusy(true);
     try { await onConfirm(result.products); setRows(null); toast("პროდუქტები იმპორტირებულია."); }
     catch (err) { setError(businessError(err)); }
     finally { setBusy(false); }
    }}>დადასტურება</Button>
    <Button variant="ghost" disabled={busy || disabled} onClick={() => { revision.current++; setRows(null); setError(""); }}>გაუქმება</Button>
   </div>
  </> : null}
 </section>;
}
