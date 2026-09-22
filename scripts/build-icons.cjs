// Builds dist/icons.svg: one Lucide sprite for every page. Symbols carry no paint attributes:
// fill, stroke and stroke width come from .icon in market.css (--icon-stroke = --theme-icon-stroke).
// Symbol ids are the names used by icon('<id>') in dist/app.js and dist/market.js.
// Downloads the pinned lucide-static version from jsDelivr; run `node scripts/build-icons.cjs`
// after adding a name below. Output is deterministic for a given version and list.
const fs = require('fs'), path = require('path');
const VERSION = '1.47.0';
const OUT = path.join(__dirname, '..', 'dist', 'icons.svg');
const SOURCE = path.join(__dirname, '..', 'dist', 'icons-source.json');

const ICONS = [
  // used by app.js and the the home pages
  'arrow-right', 'arrow-up-right', 'briefcase-business', 'building-2', 'check', 'chevron-right', 'clipboard-list',
  'download', 'globe', 'handshake', 'map-pin', 'menu', 'package', 'plus', 'search', 'sliders-horizontal', 'truck',
  'users', 'x', 'shirt', 'megaphone', 'utensils', 'calculator', 'monitor', 'hard-hat', 'scale', 'sparkles',
  // marketplace (market.js)
  'arrow-left', 'badge-check', 'ban', 'calendar', 'chevron-down', 'clock', 'clock-plus', 'eye', 'hourglass', 'image',
  'inbox', 'info', 'link', 'lock', 'log-out', 'mail', 'mail-check', 'pencil', 'phone', 'send', 'settings', 'share-2',
  'shield-check', 'store', 'trash-2', 'upload', 'user', 'user-round-check', 'wallet',
  // design system (tokens.css + market.css components, shell.js header/menu, category tiles)
  'armchair', 'bed-double', 'plane', 'shapes', 'lock-keyhole', 'copy', 'ellipsis', 'chevron-left', 'chevron-up',
  'arrow-up-down', 'list-filter', 'circle-check', 'circle-alert', 'triangle-alert', 'loader-circle', 'calendar-clock',
  'timer', 'circle-x', 'external-link', 'layout-grid', 'bell', 'file-text', 'eye-off', 'refresh-cw', 'message-square',
  'receipt', 'user-round', 'star'
];

async function get(name) {
  const url = `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} (${url})`);
  const svg = await res.text();
  const inner = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
  if (!inner) throw new Error(`${name}: empty icon`);
  return `<symbol id="${name}" viewBox="0 0 24 24">${inner}</symbol>`;
}

(async () => {
  const names = [...new Set(ICONS)];
  const symbols = [];
  for (const name of names) symbols.push(await get(name));
  fs.writeFileSync(OUT, `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`);
  fs.writeFileSync(SOURCE, JSON.stringify({ source: 'https://lucide.dev (lucide-static ' + VERSION + ')', license: 'ISC', style: 'outline, stroke from --theme-icon-stroke', icons: names }, null, 1) + '\n');
  console.log(`wrote ${names.length} icons to dist/icons.svg`);
})().catch(err => { console.error(err.message); process.exit(1); });
