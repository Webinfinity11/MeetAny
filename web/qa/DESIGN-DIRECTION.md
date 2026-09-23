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
