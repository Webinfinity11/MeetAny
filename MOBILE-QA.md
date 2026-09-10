# Mobile QA — 2026-09-10

Browser: real Chromium rendering via Playwright, mobile/touch emulation against the local static output. Not a physical iPhone or Safari test.

30 route/viewport combinations passed: V1 and V2 home, catalog, Forma Studio profile at widths 320, 360, 390, 430 and landscape 844. No horizontal document overflow, failed decoded photo assets, or JavaScript page errors.

Both variants: mobile menu open/close; search suggestions visible and clickable; search-category navigation; logistics filtering (2 results); company navigation and return with filters retained; request completion, edit retention, optional budget/deadline, text download; photo gallery open/close; company form and preview.

Fixed: V2 footer contrast, 16px mobile search fields, 44px navigation/action tap targets, sticky form actions, duplicated request form separators.

Lazy images were scrolled into view/decoded before judging image loading. Initial offscreen lazy images were not classified as failures.

## Mobile usability pass
Single-row 75px header; add-company and variant switch moved into menu. Companies promoted before industry/photo directories. V1 process tightened on mobile; V2 card media reduced. Profile offers precede facts. Filters now use native modal with focus containment, Escape/backdrop/close support, scroll lock and desktop sidebar restoration. Both variants passed filter selection, result count, modal cancellation, resizing and menu-to-company-form checks. Repeated all 30 viewport/route checks successfully.
