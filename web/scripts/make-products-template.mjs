import { deflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crc32 } from '../app/lib/xlsx-lite.js';

export const headers = ['კოდი', 'დასახელება *', 'ერთეული', 'ერთეულის ფასი (₾)', 'მოკლე აღწერა'];
export const examples = [['001', 'ხის მაგიდა', 'ცალი', 250, 'მუხის ხის მაგიდა'], ['002', 'ავეჯის მონტაჟი', 'სერვისი', '', 'მონტაჟი ადგილზე']];
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Deterministic OOXML ZIP, also used to create filled QA workbooks. Codes stay text. */
export function makeProductsTemplate(data = examples) {
 const strings = [], indexes = new Map();
 const rows = [headers, ...data].map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
  const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  const text = String(value);
  if (!indexes.has(text)) { indexes.set(text, strings.length); strings.push(text); }
  return `<c r="${ref}" t="s"><v>${indexes.get(text)}</v></c>`;
 }).join('')}</row>`).join('');
 const files = {
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="პროდუქტები" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
  'xl/sharedStrings.xml': `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" uniqueCount="${strings.length}">${strings.map(text => `<si><t xml:space="preserve">${xml(text)}</t></si>`).join('')}</sst>`,
  'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="28" customWidth="1"/><col min="5" max="5" width="44" customWidth="1"/></cols><sheetData>${rows}</sheetData></worksheet>`,
 };
 const local = [], central = []; let offset = 0;
 for (const [path, content] of Object.entries(files)) {
  const name = Buffer.from(path), data = Buffer.from(declaration + content), compressed = deflateRawSync(data), crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
  local.push(header, name, compressed); central.push(directory, name); offset += header.length + name.length + compressed.length;
 }
 const directory = Buffer.concat(central), end = Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
 return Buffer.concat([...local, directory, end]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/templates/meetany-products.xlsx');
 mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, makeProductsTemplate());
 console.log('Created public/templates/meetany-products.xlsx');
}
