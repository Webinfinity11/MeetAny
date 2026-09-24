import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { compare } from './compare.mjs';

test('0.1% boundary, FAIL artifact, dimension mismatch and stale diff cleanup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meetany-visual-'));
  try {
    const reference = path.join(dir, 'reference.png'), output = path.join(dir, 'diff.png');
    const png = new PNG({ width: 100, height: 10 }); png.data.fill(255);
    fs.writeFileSync(reference, PNG.sync.write(png));
    assert.equal(compare(reference, PNG.sync.write(png), output).percent, 0);
    png.data.set([0, 0, 0, 255], 0);
    assert.equal(compare(reference, PNG.sync.write(png), output).pass, true);
    png.data.set([0, 0, 0, 255], 4);
    assert.equal(compare(reference, PNG.sync.write(png), output).pass, false);
    assert(fs.existsSync(output));
    const other = new PNG({ width: 101, height: 10 }); other.data.fill(255);
    assert.equal(compare(reference, PNG.sync.write(other), output).pass, false);
    assert.equal(compare(reference, fs.readFileSync(reference), output).pass, true);
    assert(!fs.existsSync(output));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
