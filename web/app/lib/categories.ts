// Labels mirror site/dist/market-store.js (categories, cities, units, priceTypes) exactly —
// MarketStore is the source of truth for these at runtime; this module only adds the Lucide
// icon per category (owner decision 2026-09-22: light-blue square icon, not the 3D sprite,
// in the requests/companies sidebars — site/scripts/generate-industries.cjs:8-20 for industries,
// extended here with the two request-only categories "furniture" and "other").
export const categoryIcon: Record<string, string> = {
  furniture: "armchair",
  construction: "hard-hat",
  textiles: "shirt",
  food: "utensils",
  packaging: "package",
  logistics: "truck",
  cleaning: "sparkles",
  technology: "monitor",
  marketing: "megaphone",
  finance: "calculator",
  legal: "scale",
  tourism: "map-pin",
  other: "shapes",
};

// Companies have no photo field of their own yet (owner decision 2026-09-22: ship the catalog
// card with the industry photo now, a real per-company upload is a separate later step). One
// representative photo per category from site/web/public/assets/photos/.
export const categoryPhoto: Record<string, string> = {
  furniture: "workshop-banner.jpg",
  construction: "construction-interior.jpg",
  textiles: "hotel-linen.jpg",
  food: "fresh-produce.jpg",
  packaging: "cardboard-packaging.jpg",
  logistics: "logistics-warehouse.jpg",
  cleaning: "commercial-cleaning.jpg",
  technology: "technology-office.jpg",
  marketing: "creative-team.jpg",
  finance: "meeting.jpg",
  legal: "legal-office.jpg",
  tourism: "hotel-linen.jpg",
  other: "meeting.jpg",
};

export const categories: Record<string, string> = {
  furniture: "ავეჯი და ინვენტარი",
  construction: "მშენებლობა და რემონტი",
  textiles: "ტექსტილი და სასტუმროები",
  food: "საკვები და სასმელი",
  packaging: "შეფუთვა და წარმოება",
  logistics: "ლოგისტიკა და დისტრიბუცია",
  cleaning: "დასუფთავება და მოვლა",
  technology: "IT და ტექნოლოგიები",
  marketing: "მარკეტინგი და დიზაინი",
  finance: "ბუღალტერია და ფინანსები",
  legal: "იურიდიული მომსახურება",
  tourism: "ტურიზმი",
  other: "სხვა",
};

export const cities: Record<string, string> = {
  tbilisi: "თბილისი",
  batumi: "ბათუმი",
  kutaisi: "ქუთაისი",
  rustavi: "რუსთავი",
  zugdidi: "ზუგდიდი",
  telavi: "თელავი",
  gori: "გორი",
  georgia: "მთელი საქართველო",
};

export const units: Record<string, string> = {
  pcs: "ცალი",
  m2: "მ²",
  kg: "კგ",
  hour: "საათი",
  service: "სერვისი",
};

export const priceTypes: Record<string, string> = {
  unit: "ერთეულის ფასი",
  total: "ჯამური ფასი",
  negotiable: "შეთანხმებით",
};
