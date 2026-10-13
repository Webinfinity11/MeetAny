import { inflateRawSync } from 'node:zlib';

export const MAX_XLSX_BYTES = 2 * 1024 * 1024;
const MAX_XML_BYTES = 12 * 1024 * 1024;
const invalid = () => new Error('XLSX ფაილი დაზიანებულია ან ფორმატი არ არის მხარდაჭერილი. გამოიყენეთ შაბლონი.');
export function crc32(bytes) {
 let crc = 0xffffffff;
 for (const byte of bytes) {
  crc ^= byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
 }
 return (crc ^ 0xffffffff) >>> 0;
}
function unzip(bytes) {
 if (bytes.length > MAX_XLSX_BYTES) throw new Error('ფაილის მაქსიმალური ზომაა 2 მბ.');
 // Central directory gives reliable sizes for local headers with data descriptors (Excel/Numbers).
 let end = bytes.length - 22;
 while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
 if (end < 0 || bytes.length < 22 || bytes.readUInt32LE(end) !== 0x06054b50) throw invalid();
 const count = bytes.readUInt16LE(end + 10), directory = bytes.readUInt32LE(end + 16);
 if (count > 512 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw invalid();
 const files = new Map(); let position = directory, expanded = 0;
 for (let i = 0; i < count; i++) {
  if (position + 46 > end || bytes.readUInt32LE(position) !== 0x02014b50) throw invalid();
  const flags = bytes.readUInt16LE(position + 8), method = bytes.readUInt16LE(position + 10);
  const crc = bytes.readUInt32LE(position + 16), size = bytes.readUInt32LE(position + 20), unpacked = bytes.readUInt32LE(position + 24);
  const nameSize = bytes.readUInt16LE(position + 28), extra = bytes.readUInt16LE(position + 30), comment = bytes.readUInt16LE(position + 32);
  const local = bytes.readUInt32LE(position + 42);
  expanded += unpacked;
  if ((flags & 1) || ![0, 8].includes(method) || expanded > MAX_XML_BYTES || position + 46 + nameSize + extra + comment > end || local + 30 > directory) throw invalid();
  const name = bytes.subarray(position + 46, position + 46 + nameSize).toString('utf8');
  if (files.has(name) || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags) throw invalid();
  const localNameSize = bytes.readUInt16LE(local + 26);
  const start = local + 30 + localNameSize + bytes.readUInt16LE(local + 28);
  if (start + size > directory || bytes.subarray(local + 30, local + 30 + localNameSize).toString('utf8') !== name) throw invalid();
  const data = method === 8 ? inflateRawSync(bytes.subarray(start, start + size), { maxOutputLength: Math.min(MAX_XML_BYTES, unpacked + 1) }) : bytes.subarray(start, start + size);
  if (data.length !== unpacked || crc32(data) !== crc) throw invalid();
  files.set(name, data.toString('utf8'));
  position += 46 + nameSize + extra + comment;
 }
 return files;
}
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
 if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
 return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity];
});
const attr = (text, name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(text)?.[1];
const textRuns = xml => [...xml.replace(/<(?:\w+:)?rPh\b[^>]*>[\s\S]*?<\/(?:\w+:)?rPh>/g, '').matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(match => decode(match[1])).join('');

/** First worksheet, columns A–E, at most 500 physical rows including the heading. */
export function readProductXlsx(input) {
 try {
  const files = unzip(Buffer.from(input));
  const sheet = files.get('xl/worksheets/sheet1.xml'), shared = files.get('xl/sharedStrings.xml') || '';
  if (!sheet || /<!DOCTYPE|<!ENTITY/i.test(sheet + shared)) throw invalid();
  const strings = [...shared.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(match => textRuns(match[1]));
  const rows = []; let lastRow = 0;
  for (const match of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
   const n = Number(attr(match[1], 'r') || lastRow + 1);
   if (!Number.isInteger(n) || n <= lastRow) throw invalid();
   if (n > 500) throw new Error('ფაილში დასაშვებია მაქსიმუმ 500 რიგი.');
   while (rows.length < n) rows.push(['', '', '', '', '']);
   lastRow = n;
   const used = new Set();
   for (const cell of (match[2] || '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
    const ref = /^([A-Z]+)(\d+)$/.exec(attr(cell[1], 'r') || '');
    if (!ref || Number(ref[2]) !== n || used.has(ref[1])) throw invalid();
    used.add(ref[1]);
    if (!/^[A-E]$/.test(ref[1])) continue;
    const body = cell[2] || '', type = attr(cell[1], 't');
    if (/<(?:\w+:)?f\b/.test(body)) throw new Error(`რიგი ${n}: ფორმულის ნაცვლად ჩაწერეთ მნიშვნელობა.`);
    const value = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1] || '';
    let result = type === 'inlineStr' ? textRuns(body) : decode(value);
    if (type === 's') { if (!/^\d+$/.test(value) || strings[Number(value)] === undefined) throw invalid(); result = strings[Number(value)]; }
    else if (type && !['inlineStr', 'n', 'str'].includes(type)) throw invalid();
    if ((!type || type === 'n') && value) { if (!Number.isFinite(Number(value))) throw invalid(); result = String(Number(value)); }
    rows[n - 1][ref[1].charCodeAt(0) - 65] = result;
   }
  }
  if (!rows.length) throw invalid();
  return rows;
 } catch (err) {
  if (err instanceof Error && /^(XLSX|ფაილ|რიგი)/.test(err.message)) throw err;
  throw invalid();
 }
}
