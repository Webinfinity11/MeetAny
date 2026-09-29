// Categories (11 groups, 33 keys and "other") live in categories-data.js so market-store.js and node tests can share them.
export {
  categories, categoryGroups, categoryIcon, categoryPhoto, categoryKind, groupOf, groupNames,
  legacyCategory, categoryKeys, expandCategories, currentCategory,
} from "./categories-data.js";

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

