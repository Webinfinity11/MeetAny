# MeetAny Georgian prototype

Static home and catalog routes plus eight dedicated `/companies/{slug}/` profile pages. Georgian UI, original logo asset and supplied visual reference interpreted as an airy rounded layout. Functional demo company search, category/city/language filters, URL state, profile details, request/profile draft preparation and text download. Companies are explicitly fictional. No requests are transmitted and no personal data is persisted. Drafts exist only in page memory until the user downloads them.

Run with a static HTTP server pointing to `dist`. No build or package installation is required. Hosting configuration is in `.openai/hosting.json`.

The local reference was `ec62b8c77f017d9e28a6123ab0164157.jpg`. Logo supplied by the project owner. Decorative connection sculpture generated with imagegen. Typography uses Google Fonts Noto Sans Georgian with a system sans-serif fallback.

Validation: JavaScript syntax, local asset and route references, and focused filtering/invalid-input checks. Browser visual and interaction checks were completed. Optional WebMCP tool `set_catalog_filters` registers only if the page-scoped API is present; no supported WebMCP execution context was available for contract verification. Backend submission, real accounts and IP-based multilingual redirects are outside this Georgian design prototype.

## Photography redesign

The updated design uses an open full-page composition: no outer mockup frame or enclosing company/category card borders. It includes six real Pexels photographs, subject-specific Lucide icons, and a mobile navigation menu. Source and credit records are in `dist/assets/photos/sources.json`; the Lucide license is in `dist/assets/icons/LICENSE`. Generic stock photos do not depict or endorse the fictional demo companies.

Visual validation during the redesign covered desktop and 390px mobile layouts, plus 320px overflow checks on both routes. A legacy unbounded search SVG was replaced with the shared icon component; long Georgian headings and grid children were adjusted. Both pages measured scrollWidth equal to viewport width at 320px. Category filtering and the profile-to-request dialog flow were checked in the browser. The original optional WebMCP contract validation gap remains unchanged.

## Company profiles and identity

Company data uses stable IDs and slugs. Each company owns multiple offers (8 companies, 24 offers); catalog entries link to dedicated static profiles rather than a detail modal. Profiles include offer-specific request drafts, terms, FAQs and validated links back to filtered results. Regenerate profiles after shared markup/data changes with `node scripts/generate-profiles.cjs`.

Industry, collaboration and service format filters supplement role, service territory and language, with contextual counts and URL state. The eight fictional company logomarks are original imagegen assets served locally in a shared sprite. Loading failures show a neutral Lucide building icon without retry loops. Real company identities including Credo Bank are not in the demo dataset.

Validation: all eight logo images loaded in-browser; desktop and 320px profile layouts, filtered catalog to profile return URL, and offer-specific request prefill checked. Focused checks passed for combined/invalid filters, unsafe return URLs, unique profiles, 24 offers and logo error fallback.

## Presentation readiness

Main journey copy now describes discovery, offers and draft preparation precisely. Profile facts, offers, terms and request requirements have consistent quiet information surfaces; forms group need/company information separately from contact/service details. Draft confirmation shows the complete contact and request summary. Whitespace-only required fields are rejected and valid values are trimmed. A skip link and current navigation semantics support keyboard navigation. `PRESENTATION-GE.md` provides a five-minute Georgian walkthrough and distinguishes existing demo behavior from production work. This pass validated JavaScript, all ten static pages' local references/anchors, and draft whitespace correction; prior browser checks remain documented above.

## FiraGO and visual refinement

`dist/refinement.css` provides the shared responsive visual pass: consistent heading hierarchy, spacing, photo proportions, navigation emphasis, card metadata and navy footer. Four original FiraGO 1.001 WOFF2 weights (400/500/600/700) are hosted locally; the previous Google Fonts import is removed. Headings, buttons, inputs and body use FiraGO; the MeetAny wordmark retains its existing treatment. Font provenance and OFL license are in `dist/assets/fonts/`. Validated all ten pages' style/asset links, WOFF2 signatures and Georgian glyph coverage for every weight, plus JavaScript syntax and whitespace checks.

## Industry directory and 3D accent

The home page now distinguishes partner role from seven industry links. Each industry lists its description and company count, linking to the existing catalog industry filter. The local connection-sculpture image is reused as the single 3D accent, preserving the real business photography elsewhere. `generate-profiles.cjs` runs `generate-industries.cjs` first so directory counts follow the canonical data. Validation confirmed seven populated filter destinations, correct logistics count, and valid local assets/routes.

The industry accent now uses `connection-transparent.png`, a newly generated square 3D render with genuine RGBA transparency, replacing the opaque-background image. All corners are fully transparent; the image is displayed without a background or border radius. Generation prompt and provenance are in `connection-transparent.source.json`.

## Reference-aligned category navigation

Replaced the large decorative industry composition with compact stacked navigation. Four partner roles use newly generated transparent semantic 3D symbols (parcel, briefcase, cargo truck, handshake). Seven industries appear in a compact lower rail with purpose-specific Lucide symbols and company counts. The standalone ring artwork is no longer rendered. The category sprite has an error fallback to the corresponding line icon. Styles and scripts are versioned to refresh stale browser caches. Checked rendered category links/sprite positions, industry links, local assets, and SVG symbols.

## Structured request form

Request drafts now include scope/quantity, collaboration type, an optional budget limit with GEL/USD/EUR currency, and flexible/soon/month/specific-date timing. Conditional budget and date inputs are enabled and required only when selected. Draft review and downloaded text share the same field formatting; edit returns to the same company/offer and preserves inputs in page memory. Past/impossible dates and invalid amounts are rejected. Focused checks covered export completeness, invalid dates/amounts, and omission of inactive conditional values. Still no transmission or server storage.

The request layout is now a quick single form with four visible essentials (need, location, name/company and email). Quantity, collaboration, budget and timing live in optional expandable details. Existing optional values reopen the section during editing; invalid optional fields reveal it before validation feedback. Removed the secondary profile-copy button to emphasize the request action. Verified generated form structure, default collapsed state, labels and the primary action on every profile.
