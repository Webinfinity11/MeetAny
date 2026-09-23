# MeetAny: requests and company discovery

Research reviewed 2026-09-22. The owner approved this direction in conversation; the catalog introductions are now implemented. This is not a claim of usability testing with representative users.

The two pages serve different decisions. Requests help a supplier decide whether to respond to a specific need; companies help a buyer choose a potential partner. Keep shared navigation, typography, controls and filter behavior, while differentiating hierarchy, content and page introductions.

| Element | Requests | Companies |
| --- | --- | --- |
| Primary question | What can I supply or do? | Who can help me? |
| Introduction | Compact, practical search header | Business directory introduction with service search |
| Entry hierarchy | Need → quantity/location/deadline → responses | Company → capabilities/service area → contact |
| Image | Author's actual reference photo, when present | Small supporting image; company identity stays primary |
| Main action | View requirement, then send terms | View company or call |
| Filters | Category and destination city | Industry and service city (existing matching includes company city, service cities and all-Georgia coverage) |

Keep entries in predictable rows for comparison. A different color or a two-column grid by itself does not address the different tasks. Avoid dominant repeated category photos: current images describe an industry, not the individual company. Real company media could improve this later, without implying it already exists.

Sources:
- [NN/g: Consistency and Standards](https://www.nngroup.com/articles/consistency-and-standards/) — familiar controls and consistent meanings across a product.
- [NN/g: Cards](https://www.nngroup.com/articles/cards-component/) — predictable lists support scanning and comparison; cards have tradeoffs.
- [Baymard: Product Listing Information](https://baymard.com/research-articles/product-listing-information) — include the attributes needed to judge relevance without opening each entry. This is ecommerce research, applied here as a general principle, not direct evidence about MeetAny.
- [Thomasnet: Supplier Discovery](https://sourcing.thomasnet.com/) — search, evaluate capabilities, contact a supplier.
- [Upwork: Job Search](https://support.upwork.com/hc/en-us/articles/211063078-How-to-search-for-jobs-on-Upwork) — keyword search and filters for finding relevant work. A workflow reference, not a layout to copy.

Implemented during this review: shorter category labels with full accessible names, separate counts, compact company photos, removal of catalog verification badges, full-width company descriptions, and a request detail reading column with a contact aside and company response in the reading column. Distinct catalog introductions are implemented: compact white work-search header for requests, a light-blue supplier directory introduction for companies. Redundant section headings and missing-date placeholder text were removed. Search IDs, URL state, filtering and keyboard behavior are preserved.


## Simplification after owner feedback, 2026-09-23

Reviewed [wlw](https://www.wlw.de/en), [Europages](https://www.europages.co.uk/) and [iTrade](https://itrade.ge/ka) public entry points. The owner wants less interface friction, not a literal marketing statement of the international strategy. Our design interpretation is to prioritize search, results and direct contact.

This supersedes the earlier light-blue catalog introduction: both catalog headers now use concise titles and search. Companies remain a directory with capability chips, small photos and call/profile actions. Requests prioritize the need itself, followed by category, author and logistics. Removed category-photo promotions and the large CTA from the company results page; all categories remain accessible through filters. Company activity statistics remain in profiles. Mobile filter/sort controls share one row. Search has an explicit clear control that restores input focus. No country/language filters are presented before the data and behavior exist.

These are implementation and browser checks, not a claim of measured usability improvement with users.

## Profile and shared navigation review, 2026-09-23

The profile previously prioritized an industry stock photo, repeated section eyebrows, and a large facts sidebar over capabilities and contact. The header also used an unbounded company name as its account control, while footer navigation mixed discovery and legal links at the same level.

Changed: compact company identity with a visible call action; a separate service-area row; description and services in the main column; collaboration interests in a secondary panel; open requests below; activity statistics as secondary metadata at the end. Removed the decorative photo hero, duplicate section labels, facts sidebar and oversized concluding CTA. The category-specific request action remains beside open requests. Header account control is now “ჩემი ანგარიში” for every signed-in role, including the mobile navigation heading. Footer separates discovery from contact/legal links and removes the promotional sentence.

Critical review criteria going forward: Can a visitor identify the page purpose and next action? Does the first screen prioritize useful information? Are labels understandable without inference? Are secondary details taking attention from decisions? Does real Georgian text fit at intermediate widths? Do empty, long-content and authenticated states remain usable?

Remaining design limitations: catalog company images still represent a category rather than a specific business. The mobile creation control now includes a visible label (see the detail pass below). These are distinct from verified layout failures. Browser screenshots and successful builds do not establish usability with real businesses; that needs task-based observation (find a supplier, call, publish a need, send an offer).


## Interaction and visual detail pass, 2026-09-23

The owner requested closer attention to icons, buttons and a recognizable MeetAny identity. Kept the Georgian type hierarchy, logo and blue/navy palette; refined the working interface with a compact control radius, a line marking the active desktop navigation destination, quieter stable list rows and outlined service labels. Company profile navigation now uses the same button component classes as other actions, removing the conflicting legacy `.button` rules.

Icons keep the established Lucide family and stroke weight, now with an explicit 24-unit viewBox, decorative semantics and a semantic data attribute. Only forward navigation arrows move on hover; contact icons stay still. Buttons no longer shrink under a press. Reduced-motion preference suppresses arrow movement. Calls separate the label from the tabular, nonwrapping number. Mobile creation reads “დამატება” at every width, with the full accessible name “მოთხოვნის დამატება”; the plus icon is omitted only below 360px to preserve readable text and touch targets.

This is a refinement of a consistent B2B interface, not evidence that observers will attribute its design to a human. Distinctive content and actual company photography remain important to its identity.

## Guided search and a sector index, 2026-09-23

Following the owner's request, the filter rail is now an unboxed directory index with custom sector drawings, plain counts and an underlined selection. Conditions are separated by rules. Category drawings use an original shared 32-unit SVG grid and blue filled planes; action icons retain the established Lucide family. This supersedes the earlier category-icon direction.

Additional filters use existing data only: request publication time, zero offers, expiration within three days and a photo; company activity type and explicitly nationwide coverage. Activity type reuses existing store classification (industry-based supplier/service/distribution, declared partnership interests), not a newly verified company attribute. Company sorting offers registration date and Georgian name order.

Search now offers categories and live records on focus, narrowing on input. Category selection refines the catalog; record selection opens its detail page. The same combobox serves home and catalogs, with explicit keyboard selection, focus handling and empty-result feedback. Mobile search-type labels wrap rather than clipping. No country filters, invented inventory, or generated company facts were introduced.
