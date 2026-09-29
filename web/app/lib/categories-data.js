// The only source of request categories and company directions: 11 groups, 33 categories and "other".
// Keys are stored in the database (meetany_private.categories(), db/migrations/20260929-categories.sql);
// keep the two lists identical. Plain JS so market-store.js and the node tests can import it.
// Kind: "product" (a company supplies goods) or "service"; it drives the catalog type filter.
export const categoryGroups = [
  { id: "food", short: "საკვები და სასმელი", name: "საკვები და სასმელი", icon: "utensils", photo: "fresh-produce.jpg", items: [
    ["food_fresh", "ახალი პროდუქტი", "product"],
    ["food_processed", "დაფასოებული საკვები", "product"],
    ["beverages", "სასმელები და ღვინო", "product"],
    ["catering", "კვების ორგანიზება", "service"],
  ] },
  { id: "construction", short: "მშენებლობა", name: "მშენებლობა და რემონტი", icon: "hard-hat", photo: "construction-interior.jpg", items: [
    ["building_materials", "სამშენებლო მასალები", "product"],
    ["renovation", "რემონტი და მოწყობა", "service"],
    ["engineering", "ელექტრო/სანტექნიკა", "service"],
  ] },
  { id: "interior", short: "ავეჯი და ტექსტილი", name: "ავეჯი, ინვენტარი და ტექსტილი", icon: "armchair", photo: "workshop-banner.jpg", items: [
    ["furniture", "ავეჯი", "product"],
    ["equipment", "კომერციული ინვენტარი", "product"],
    ["textiles", "ტექსტილი", "product"],
  ] },
  { id: "production", short: "წარმოება", name: "წარმოება და შეფუთვა", icon: "package", photo: "cardboard-packaging.jpg", items: [
    ["packaging", "შეფუთვა და ეტიკეტი", "product"],
    ["printing", "პოლიგრაფია და ბეჭდვა", "service"],
  ] },
  { id: "logistics", short: "ლოგისტიკა", name: "ტრანსპორტი და ლოგისტიკა", icon: "truck", photo: "logistics-warehouse.jpg", items: [
    ["freight", "ტვირთის გადაზიდვა", "service"],
    ["warehouse", "საწყობი და შენახვა", "service"],
    ["customs", "საბაჟო მომსახურება", "service"],
  ] },
  { id: "trade", short: "ვაჭრობა", name: "ვაჭრობა და მომარაგება", icon: "store", photo: "logistics-warehouse.jpg", items: [
    ["wholesale", "საბითუმო მომარაგება", "product"],
    ["office_household", "საოფისე და სამეურნეო", "product"],
  ] },
  { id: "facility", short: "ობიექტის მოვლა", name: "ობიექტის მომსახურება", icon: "sparkles", photo: "commercial-cleaning.jpg", items: [
    ["cleaning", "დასუფთავება", "service"],
    ["laundry", "რეცხვა და ქიმწმენდა", "service"],
    ["technical_service", "ტექნიკის სერვისი", "service"],
    ["security", "დაცვა, უსაფრთხოება", "service"],
  ] },
  { id: "it", short: "IT და ციფრული", name: "IT და ციფრული", icon: "monitor", photo: "technology-office.jpg", items: [
    ["software_web", "ვებსაიტი და აპები", "service"],
    ["it_support", "IT მხარდაჭერა", "service"],
  ] },
  { id: "marketing", short: "მარკეტინგი", name: "მარკეტინგი და რეკლამა", icon: "megaphone", photo: "creative-team.jpg", items: [
    ["branding_design", "ბრენდინგი და დიზაინი", "service"],
    ["advertising", "რეკლამა და SMM", "service"],
    ["photo_video", "ფოტო და ვიდეო", "service"],
    ["events", "ღონისძიებები", "service"],
  ] },
  { id: "business", short: "ბიზნეს-მომსახურება", name: "ბიზნეს-მომსახურება", icon: "calculator", photo: "meeting.jpg", items: [
    ["accounting", "ბუღალტერია და აუდიტი", "service"],
    ["legal", "იურიდიული სერვისი", "service"],
    ["consulting", "კონსალტინგი", "service"],
    ["hr_training", "პერსონალი, ტრენინგი", "service"],
  ] },
  { id: "tourism", short: "ტურიზმი", name: "ტურიზმი და სტუმარმასპინძლობა", icon: "bed-double", photo: "hotel-linen.jpg", items: [
    ["hotel_services", "სასტუმროს სერვისი", "service"],
    ["tours", "ტურები და ტრანსფერი", "service"],
  ] },
  { id: "other", short: "სხვა", name: "სხვა", icon: "shapes", photo: "meeting.jpg", items: [
    ["other", "სხვა", "service"],
  ] },
];

// group.short is the catalog sidebar label (the rail is narrow and labels do not wrap).
// Category (leaf) key -> Georgian name; the stored value everywhere.
export const categories = Object.fromEntries(categoryGroups.flatMap(g => g.items.map(([key, name]) => [key, name])));
export const groupOf = Object.fromEntries(categoryGroups.flatMap(g => g.items.map(([key]) => [key, g.id])));
export const groupNames = Object.fromEntries(categoryGroups.map(g => [g.id, g.name]));
export const categoryKind = Object.fromEntries(categoryGroups.flatMap(g => g.items.map(([key, , kind]) => [key, kind])));
export const categoryIcon = Object.fromEntries(categoryGroups.flatMap(g => g.items.map(([key]) => [key, g.icon])));
const leafPhoto = { textiles: "hotel-linen.jpg", legal: "legal-office.jpg" };
export const categoryPhoto = Object.fromEntries(categoryGroups.flatMap(g => g.items.map(([key]) => [key, leafPhoto[key] || g.photo])));

// Old 13 keys -> new category. Same mapping as db/migrations/20260929-categories.sql.
export const legacyCategory = {
  furniture: "furniture", construction: "renovation", textiles: "textiles", food: "food_fresh",
  packaging: "packaging", logistics: "freight", cleaning: "cleaning", technology: "software_web",
  marketing: "branding_design", finance: "accounting", legal: "legal", tourism: "tours", other: "other",
};

/** A category key, a group key or an old key (?category=technology in an old link) -> the categories it means. */
export function categoryKeys(key) {
  if (!key) return [];
  if (Object.hasOwn(categories, key)) return [key];
  const group = categoryGroups.find(g => g.id === key);
  if (group) return group.items.map(([k]) => k);
  return Object.hasOwn(legacyCategory, key) ? [legacyCategory[key]] : [key];
}
/** Comma list (as filters store it) -> the categories it means. */
export const expandCategories = list => (list || "").split(",").flatMap(categoryKeys);
/** The key to store for an old link, or the same key when it is already current. */
export const currentCategory = key => (Object.hasOwn(categories, key) ? key : categoryGroups.some(g => g.id === key) ? key : legacyCategory[key] || key);
