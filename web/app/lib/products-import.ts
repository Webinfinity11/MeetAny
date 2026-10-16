export const PRODUCT_UNITS = { pcs: "ცალი", m2: "მ²", kg: "კგ", hour: "საათი", service: "სერვისი", m: "მ", l: "ლ", set: "კომპლექტი", pack: "შეკვრა" } as const;
export type ProductUnit = keyof typeof PRODUCT_UNITS;
export type ImportProduct = { name: string; photoUrl?: string | null; code?: string; unit?: ProductUnit; price?: number; note?: string };
export type ProductImportError = { row: number; column: string; message: string };
export const PRODUCT_HEADERS = ["კოდი", "დასახელება *", "ერთეული", "ერთეულის ფასი (₾)", "მოკლე აღწერა"];
export const productKey = (product: Pick<ImportProduct, "name" | "code">) => product.code?.trim() ? `code:${product.code.trim()}` : `name:${product.name.trim().toLocaleLowerCase("ka")}`;

/** Returns the complete replacement catalog; invalid rows are omitted, errors block confirmation. */
export function parseProductRows(rows: string[][], { existing, gallery }: { existing: ImportProduct[]; gallery: string[] }) {
 const products = existing.map(product => ({ ...product }));
 const errors: ProductImportError[] = [];
 const error = (row: number, column: string, message: string) => errors.push({ row, column, message });
 if (rows.length > 500) {
  error(0, "", "ფაილში დასაშვებია მაქსიმუმ 500 რიგი.");
  return { products, errors };
 }
 if (!PRODUCT_HEADERS.every((title, i) => rows[0]?.[i]?.replace(/^\uFEFF/, "").trim() === title)) {
  error(1, "", "სათაურები არ ემთხვევა შაბლონს — გამოიყენეთ ჩამოსატვირთი შაბლონი.");
  return { products, errors };
 }
 const seen = new Map<string, number>();
 rows.slice(1).forEach((cells, index) => {
  const row = index + 2;
  if (cells.every(cell => !cell.trim())) return;
  const [code = "", name = "", rawUnit = "", rawPrice = "", note = ""] = cells.map(cell => cell.trim());
  const before = errors.length;
  if (!name) error(row, "B", "დასახელება აკლია");
  else if ([...name].length < 2 || [...name].length > 80) error(row, "B", "დასახელება უნდა შეიცავდეს 2–80 სიმბოლოს");
  if ([...code].length > 40) error(row, "A", "კოდი უნდა შეიცავდეს მაქსიმუმ 40 სიმბოლოს");
  if ([...note].length > 200) error(row, "E", "აღწერა უნდა შეიცავდეს მაქსიმუმ 200 სიმბოლოს");
  const unit = Object.keys(PRODUCT_UNITS).find(key => key === rawUnit || PRODUCT_UNITS[key as ProductUnit] === rawUnit) as ProductUnit | undefined;
  if (rawUnit && !unit) error(row, "C", `ერთეული უცნობია — გამოიყენეთ ${Object.values(PRODUCT_UNITS).join(" / ")}`);
  const price = rawPrice ? Number(rawPrice.replace(",", ".")) : undefined;
  if (rawPrice && (!/^\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(rawPrice) || !Number.isFinite(price) || price! > 1e9)) error(row, "D", "ფასი უნდა იყოს რიცხვი 0-დან 1 000 000 000-მდე");
  const product: ImportProduct = { name, note, ...(code ? { code } : {}), ...(unit ? { unit } : {}), ...(price !== undefined ? { price } : {}) };
  const key = productKey(product);
  if (seen.has(key)) error(row, code ? "A" : "B", `კოდი/დასახელება მეორდება რიგთან ${seen.get(key)}`);
  else seen.set(key, row);
  if (before !== errors.length) return;
  const matches = products.flatMap((item, i) => productKey(item) === key ? [i] : []);
  if (matches.length > 1) { error(row, "A", "არსებულ სიაში კოდი/დასახელება რამდენჯერმე გვხვდება — გაასწორეთ სია"); return; }
  if (matches.length) {
   const at = matches[0], photo = products[at].photoUrl;
   products[at] = { ...product, photoUrl: photo && gallery.includes(photo) ? photo : null };
  } else products.push(product);
 });
 if (products.length > 15) error(0, "", `ჯამში ${products.length} პროდუქტია — დასაშვებია მაქსიმუმ 15.`);
 return { products, errors };
}

/** UTF-8 CSV, quoted delimiters/newlines, doubled quotes, BOM and CRLF. */
export function parseProductCsv(text: string): string[][] {
 text = text.replace(/^\uFEFF/, "");
 const first = text.split(/\r?\n/, 1)[0];
 const delimiter = first.includes(";") ? ";" : ",";
 const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
 for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (quoted) {
   if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
   else if (c === '"') { quoted = false; closed = true; }
   else cell += c;
  } else if (c === '"' && !cell && !closed) quoted = true;
  else if (c === delimiter) { row.push(cell); cell = ""; closed = false; }
  else if (c === "\n" || c === "\r") {
   if (c === "\r" && text[i + 1] === "\n") i++;
   row.push(cell); rows.push(row); row = []; cell = ""; closed = false;
   if (rows.length > 500) throw new Error("ფაილში დასაშვებია მაქსიმუმ 500 რიგი.");
  } else if (closed || c === '"') throw new Error("CSV ფაილში ბრჭყალები არასწორადაა გამოყენებული.");
  else cell += c;
 }
 if (quoted) throw new Error("CSV ფაილში ბრჭყალი დაუხურავია.");
 if (cell || row.length) { row.push(cell); rows.push(row); }
 if (rows.length > 500) throw new Error("ფაილში დასაშვებია მაქსიმუმ 500 რიგი.");
 return rows;
}
