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
