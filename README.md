# MeetAny Georgian prototype

Two static routes: `/` and `/categories/`. Georgian UI, original logo asset and supplied visual reference interpreted as an airy rounded layout. Functional demo company search, category/city/language filters, URL state, profile details, request/profile draft preparation and text download. Companies are explicitly fictional. No requests are transmitted and no personal data is persisted. Drafts exist only in page memory until the user downloads them.

Run with a static HTTP server pointing to `dist`. No build or package installation is required. Hosting configuration is in `.openai/hosting.json`.

The local reference was `ec62b8c77f017d9e28a6123ab0164157.jpg`. Logo supplied by the project owner. Decorative connection sculpture generated with imagegen. Typography uses Google Fonts Noto Sans Georgian with a system sans-serif fallback.

Validation: JavaScript syntax, local asset and route references, and focused filtering/invalid-input checks. Browser visual/interaction testing was not requested. Optional WebMCP tool `set_catalog_filters` registers only if the page-scoped API is present; no supported WebMCP execution context was available for contract verification. Backend submission, real accounts and IP-based multilingual redirects are outside this Georgian design prototype.
