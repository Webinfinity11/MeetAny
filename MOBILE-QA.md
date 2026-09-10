# Mobile QA — 2026-09-10

Browser: real Chromium rendering via Playwright, mobile/touch emulation against the local static output. Not a physical iPhone or Safari test.

30 route/viewport combinations passed: V1 and V2 home, catalog, Forma Studio profile at widths 320, 360, 390, 430 and landscape 844. No horizontal document overflow, failed decoded photo assets, or JavaScript page errors.

Both variants: mobile menu open/close; search suggestions visible and clickable; search-category navigation; logistics filtering (2 results); company navigation and return with filters retained; request completion, edit retention, optional budget/deadline, text download; photo gallery open/close; company form and preview.

Fixed: V2 footer contrast, 16px mobile search fields, 44px navigation/action tap targets, sticky form actions, duplicated request form separators.

Lazy images were scrolled into view/decoded before judging image loading. Initial offscreen lazy images were not classified as failures.
