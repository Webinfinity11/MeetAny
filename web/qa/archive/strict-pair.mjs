// წყვილები: მარცხნივ დიზაინი (.shots/<name>@<w>.png), მარჯვნივ საიტი (site/<name>-<w>.png). გამოყენება: node pair.mjs <outdir> [name...]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('/tmp/meetany-qa/package.json')('sharp');
const outDir = process.argv[2]; const only = process.argv.slice(3);
const siteDir = process.env.QA_OUT || '/tmp/meetany-qa/strict/site'; fs.mkdirSync(outDir, { recursive: true });
const report = JSON.parse(fs.readFileSync(path.join(siteDir, 'report.json'), 'utf8'));
const base = fs.readdirSync('/tmp/meetany-design/artboards').map(f => f.replace('.tsx', ''));
const names = [...new Set(fs.readdirSync(siteDir).filter(f => f.endsWith('.png')).map(f => f.replace(/-(1200|390)\.png$/, '')))].filter(n => base.includes(n.replace(/-(linen|cta|register-company|register-client|reset)$/, ''))).filter(n => !only.length || only.includes(n));
const label = (t, w) => Buffer.from(`<svg width="${w}" height="30"><rect width="${w}" height="30" fill="#111"/><text x="10" y="20" font-family="Helvetica,Arial" font-size="14" fill="#fff">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
let made = 0;
for (const n of names) for (const w of [1200, 390]) {
  const design = `/tmp/meetany-design/.shots/${n.replace(/-(linen|cta|register-company|register-client|reset)$/, '')}@${w}.png`, site = path.join(siteDir, `${n}-${w}.png`);
  if (!fs.existsSync(design) || !fs.existsSync(site)) { console.log('skip', n, w, fs.existsSync(design) ? '' : 'no design', fs.existsSync(site) ? '' : 'no site'); continue; }
  const [dm, sm] = await Promise.all([sharp(design).metadata(), sharp(site).metadata()]);
  const dh = Math.round(dm.height * w / dm.width), sh = Math.round(sm.height * w / sm.width);
  const H = Math.max(dh, sh) + 30, gap = 24, W = w * 2 + gap;
  const v = report.views[`${n}-${w}`] || {};
  const layers = [
    { input: label(`DESIGN  ${n}@${w}`, w), left: 0, top: 0 },
    { input: label(`SITE  ${v.url || v.route || ''}  ${v.role || ''}`.slice(0, 110), w), left: w + gap, top: 0 },
    { input: await sharp(design).resize({ width: w }).png().toBuffer(), left: 0, top: 30 },
    { input: await sharp(site).resize({ width: w }).png().toBuffer(), left: w + gap, top: 30 },
  ];
  await sharp({ create: { width: W, height: H, channels: 3, background: '#c8c8c8' } }).composite(layers).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(path.join(outDir, `${n}-${w}.png`));
  made++;
}
console.log(`pairs: ${made} → ${outDir}`);
