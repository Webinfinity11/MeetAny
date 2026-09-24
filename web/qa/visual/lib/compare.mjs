import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
export function compare(reference, actual, output) {
  const a = PNG.sync.read(fs.readFileSync(reference)), b = PNG.sync.read(actual);
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height);
  const diff = new PNG({ width, height });
  let percent = 100;
  if (a.width === b.width && a.height === b.height) {
    percent = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1, includeAA: true }) / (width * height) * 100;
  } else {
    // Canvas-size changes always fail; show current pixels on magenta uncovered canvas.
    for (let i = 0; i < diff.data.length; i += 4) diff.data.set([255, 0, 255, 255], i);
    PNG.bitblt(b, diff, 0, 0, b.width, b.height, 0, 0);
  }
  const pass = percent <= 0.1;
  if (!pass) fs.writeFileSync(output, PNG.sync.write(diff));
  else fs.rmSync(output, { force: true });
  return { percent, pass, width: b.width, height: b.height };
}
