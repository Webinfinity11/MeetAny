# MeetAny design system

## URLs and local run

The site is served at the root: `/`, `/requests/`, `/requests/new/`, `/requests/view/?id=`, `/companies/`, `/companies/view/?id=`, `/account/`, `/admin/`, `/terms/`. Files live directly in `dist/` (no `v2` folder). Old `/v2/...` links redirect permanently to the root URL (`vercel.json`). `/api/db/*` is the data API (`api/db.js`).

Design 01 ინახება `site/archive/v1/`-ში; deploy-ში არ შედის (`outputDirectory: dist` და `.vercelignore`-ის `archive`). `/v1` და `/v1/*` დროებითი redirect-ით გადადის `/`-ზე. არქივი არ წაშალოთ.

Local: `node scripts/dev-server.cjs` → http://127.0.0.1:4031/. It applies the same `vercel.json` redirects and rewrites and runs `api/*` with `.env.dev.local`.

## Changing the look: edit the theme knobs

The top of `:root` in `dist/tokens.css` holds the only values to edit when the look changes. Everything else is derived from them.

| knob | default | what follows from it |
|---|---|---|
| `--theme-primary` | `#245DDD` | the whole blue ramp (`--blue-50` … `--blue-900`), buttons, links, focus ring, selection, hero, tiles |
| `--theme-accent` | `#FE8E2F` | the orange ramp: dots, accent badges, step numbers |
| `--theme-ink` | `#172D44` | text and every neutral (`--ink-50` … `--ink-950`), borders, shadows |
| `--theme-surface` | `#FFFFFF` | page and card background |
| `--theme-font` | `FiraGO` | every text |
| `--theme-radius` | `10px` | xs/sm = ×0.6, md = ×1, lg/xl = ×1.6 (6/10/16 ბაზა 10-ზე) |
| `--theme-icon-stroke` | `1.75` | outline weight of every Lucide icon |

Ramps are mixed with `color-mix()`, so a new primary or ink colour gives a full, consistent scale. After changing a colour, check the contrast of text on white: `--ink-600` for secondary text, `--orange-600` for accent text and white on `--theme-primary` must stay ≥ 4.5:1.

To try a knob without editing files, paste into the browser console:

```js
document.documentElement.style.setProperty('--theme-primary', '#0E7A4F')
```

## Rules for components (`market.css`)

- Read role tokens (`--action`, `--text-2`, `--border`, `--radius-md`, `--shadow-2`, …). No hex, rgba or px radius literals.
- Sentence case everywhere (spec §1.5, §3). Mtavruli (`font-feature-settings:"case"`) only on the 11px `.ma-eyebrow` (token `--ff-eyebrow`); never on headings, buttons or user content.
- Sizes: controls 44px; `ma-btn--sm`, small pills and compact selects shrink to 36px only at ≥1024px with a fine pointer. Every tap target below 1024px is at least 44px.
- Icons: `<svg class="icon"><use href="/icons.svg#name"></use></svg>`. The sprite carries no paint attributes; size and stroke come from `.icon` and the tokens (`--icon-sm` 16, `--icon-btn` 18, `--icon` 20, `--icon-lg` 24). To add an icon, add its Lucide name to `scripts/build-icons.cjs` and run it.
- The home page (`dist/index.html`) is hand-maintained markup; the generator only refreshes its head, header and footer.
- New page: add it to `scripts/generate-market.cjs` (`page({...})`). It gets the shell, both stylesheets and the scripts, then run `node scripts/generate-market.cjs`.

## Files

| file | role |
|---|---|
| `dist/tokens.css` | theme knobs + derived tokens |
| `dist/home.css` | home page styles (kept layout of Design 02); edit directly, tokens only |
| `dist/market.css` | components, sections 0–11 (11 = home), 99 = legacy `m-*` bridge for account/admin/dialogs |
| `dist/icons.svg` | Lucide sprite (built) |
| `scripts/build-icons.cjs` | builds the sprite |
| `scripts/shell.html` | header, mobile menu, footer shared by all pages |
| `scripts/generate-market.cjs` | builds every page, including the home page |
