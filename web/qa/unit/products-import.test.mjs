import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readProductXlsx, crc32 } from '../../app/lib/xlsx-lite.js';
import { makeProductsTemplate, headers, examples } from '../../scripts/make-products-template.mjs';

const source = readFileSync(new URL('../../app/lib/products-import.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { parseProductRows, parseProductCsv } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const parse = (rows, existing = [], gallery = []) => parseProductRows(rows, { existing, gallery });
const row = (values = {}) => Object.assign(['001', 'ხის მაგიდა', 'ცალი', '250', 'მუხა'], values);

test('template is a readable XLSX and preserves leading zero codes and optional price', () => {
 const rows = readProductXlsx(makeProductsTemplate());
 assert.deepEqual(rows, [headers, ...examples.map(row => row.map(String))]);
 const result = parse(rows);
 assert.deepEqual(result.errors, []);
 assert.deepEqual(result.products[0], { code: '001', name: 'ხის მაგიდა', unit: 'pcs', price: 250, note: 'მუხის ხის მაგიდა' });
 assert.equal(result.products[1].price, undefined);
});
test('empty name, unknown unit and textual price get Georgian row/column errors', () => {
 for (const [column, value, expected] of [[1, '', 'B'], [2, 'ყუთი', 'C'], [3, 'უფასო', 'D']]) {
  const { errors, products } = parse([headers, row({ [column]: value })]);
  assert.equal(products.length, 0); assert.equal(errors[0].row, 2); assert.equal(errors[0].column, expected);
 }
});
test('15 rows fit; 16 rows exceed the final catalog limit', () => {
 const rows = Array.from({ length: 16 }, (_, i) => [`${i}`, `პროდუქტი ${i}`, '', '', '']);
 assert.equal(parse([headers, ...rows.slice(0, 15)]).errors.length, 0);
 assert.match(parse([headers, ...rows]).errors[0].message, /15/);
 assert.equal(parse(readProductXlsx(makeProductsTemplate(rows.slice(0, 15)))).products.length, 15);
});
test('updates replace fields, preserve gallery photos and do not count against the limit', () => {
 const existing = Array.from({ length: 15 }, (_, i) => ({ code: `${i}`, name: `ძველი ${i}`, price: 12, photoUrl: 'owned' }));
 const { products, errors } = parse([headers, ['0', 'ახალი სახელი', '', '', '']], existing, ['owned']);
 assert.equal(errors.length, 0); assert.equal(products.length, 15);
 assert.deepEqual(products[0], { code: '0', name: 'ახალი სახელი', note: '', photoUrl: 'owned' });
 assert.equal(existing[0].name, 'ძველი 0');
 assert.equal(parse([headers, ['', ' NAME ', '', '', '']], [{ name: 'name' }]).products.length, 1);
});
test('duplicate file keys report both source row numbers', () => {
 const { errors } = parse([headers, row(), row()]);
 assert.equal(errors[0].row, 3); assert.match(errors[0].message, /2/);
});
test('CSV accepts BOM, separators, CRLF, quoted decimal comma and multiline escaped quotes', () => {
 for (const delimiter of [';', ',']) {
  const csv = '\uFEFF' + headers.join(delimiter) + '\r\n' + ['001', 'მაგიდა', 'ცალი', '"12,50"', '"ხე\n""მუხა"""'].join(delimiter);
  const result = parse(parseProductCsv(csv));
  assert.equal(result.errors.length, 0); assert.equal(result.products[0].price, 12.5); assert.equal(result.products[0].note, 'ხე\n"მუხა"');
 }
 assert.throws(() => parseProductCsv('"ღია'), /ბრჭყალი/);
});
test('limits, malformed archives and incorrect headers fail clearly', () => {
 assert.throws(() => readProductXlsx(Buffer.alloc(2 * 1024 * 1024 + 1)), /2 მბ/);
 assert.throws(() => readProductXlsx(Buffer.from('not zip')), /XLSX/);
 assert.throws(() => readProductXlsx(makeProductsTemplate(Array.from({ length: 500 }, () => row()))), /500 რიგი/);
 assert.equal(parse([['other'], row()]).errors[0].row, 1);
 for (const price of ['-1', '0x10', '1000000001', 'Infinity']) assert.equal(parse([headers, row({ 3: price })]).errors[0].column, 'D');
 assert.equal(parse([headers, row({ 3: '1e-7' })]).products[0].price, 1e-7);
});

// An independently assembled stored ZIP with a data descriptor (not our template writer).
function inlineWorkbook(sheet) {
 const data = Buffer.from(sheet), name = Buffer.from('xl/worksheets/sheet1.xml'), checksum = crc32(data);
 const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 6); local.writeUInt16LE(name.length, 26);
 const descriptor = Buffer.alloc(16); descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(checksum, 4); descriptor.writeUInt32LE(data.length, 8); descriptor.writeUInt32LE(data.length, 12);
 const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 8); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
 const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + data.length + descriptor.length, 16);
 return Buffer.concat([local, name, data, descriptor, central, name, end]);
}
test('stored ZIP/data descriptors, inline rich text, entities, sparse rows and scientific numbers', () => {
 const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t>00</t></r><r><t>1 &amp; &#x10EE;</t></r></is></c></row><row r="3"><c r="B3" t="inlineStr"><is><t>ხე</t></is></c><c r="D3"><v>1E+3</v></c></row></sheetData></worksheet>';
 assert.deepEqual(readProductXlsx(inlineWorkbook(sheet)), [['001 & ხ', '', '', '', ''], ['', '', '', '', ''], ['', 'ხე', '', '1000', '']]);
 assert.throws(() => readProductXlsx(inlineWorkbook('<worksheet><sheetData><row r="501"/></sheetData></worksheet>')), /500/);
 assert.throws(() => readProductXlsx(inlineWorkbook('<worksheet><sheetData><row r="1"><c r="D1"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>')), /ფორმულის/);
 const broken = inlineWorkbook(sheet); broken[65] ^= 1; assert.throws(() => readProductXlsx(broken), /XLSX/);
});

test('same-name coded variants survive import without being merged', () => {
 const result = parse([headers, ['A', 'მაგიდა', '', '', ''], ['B', 'მაგიდა', '', '', '']]);
 assert.deepEqual(result.errors, []);
 assert.equal(result.products.length, 2);
});
