import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {}, URL };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../../app/lib/product-presentation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { productPresentation } = context.exports;
const owner = '74cc28fc-47de-45cb-9563-93735b86855e';
const demo = { name: 'კაფის ხის მაგიდა 70×70', note: 'სადემო პროდუქტი · ფოტო საილუსტრაციოა; ხის ზედაპირი.', photoUrl: `https://demo.public.blob.vercel-storage.com/${owner}/gallery-demo-wood-original.jpg` };
test('explicit legacy demo products receive distinct, disclosed illustrations without mutating catalog data', () => {
  const snapshot = JSON.stringify(demo);
  const table = productPresentation(demo, owner), shelf = productPresentation({ ...demo, name: 'სავაჭრო თარო' }, owner);
  assert(table.illustrative); assert(shelf.illustrative);
  assert.match(table.photoUrl, /cafe-table/); assert.match(shelf.photoUrl, /shop-shelves/);
  assert.equal(JSON.stringify(demo), snapshot);
});
test('new owner uploads and unrelated products are never substituted', () => {
  for (const product of [{ ...demo, note: 'ჩემი პროდუქტი' }, { ...demo, photoUrl: `https://demo.public.blob.vercel-storage.com/${owner}/gallery-new.jpg` }, { ...demo, name: 'სხვა პროდუქტი' }]) {
    assert.equal(productPresentation(product, owner).photoUrl, product.photoUrl);
  }
  assert.equal(productPresentation(demo, 'other-company').photoUrl, demo.photoUrl);
});
test('shared preview can derive the seeded owner while malformed and local sources remain unchanged', () => {
  assert.match(productPresentation(demo).photoUrl, /cafe-table/);
  for (const photoUrl of [null, '', '/assets/test.jpg', 'not a url']) assert.equal(productPresentation({ ...demo, photoUrl }).photoUrl, photoUrl);
});
test('published demo revision uses the exact legacy asset while preserving subsequent owner photos', () => {
  const published = { ...demo, note: 'სადემო · ფოტო საილუსტრაციოა. ხის მაგიდა.', photoUrl: `https://k3kp1syowhtmw3er.public.blob.vercel-storage.com/${owner}/gallery-demo-photo-1791467184924-nSZwnuqECRCp2KM0RqEr62bWfUxTiH.jpg` };
  assert.match(productPresentation(published, owner).photoUrl, /cafe-table/);
  assert.match(productPresentation({ ...published, name: 'სავაჭრო თარო' }, owner).photoUrl, /shop-shelves/);
  const replacement = { ...published, photoUrl: published.photoUrl.replace('1791467184924', '1792067184924') };
  assert.equal(productPresentation(replacement, owner).photoUrl, replacement.photoUrl);
  assert.equal(productPresentation({ ...published, note: 'მომხმარებლის ფოტო' }, owner).photoUrl, published.photoUrl);
});
