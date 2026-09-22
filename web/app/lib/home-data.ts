export const categories = [
  { id: "suppliers", title: "მომწოდებელი", sub: "პროდუქტი და წარმოება", icon: "package" },
  { id: "services", title: "მომსახურება", sub: "ექსპერტიზა შენი ბიზნესისთვის", icon: "briefcase-business" },
  { id: "distributors", title: "დისტრიბუტორი", sub: "ახალი ბაზარი და გაყიდვები", icon: "truck" },
  { id: "partners", title: "ბიზნესპარტნიორი", sub: "ერთობლივი შესაძლებლობები", icon: "handshake" },
] as const;

export const industries = [
  { id: "textiles", title: "ტექსტილი", name: "ტექსტილი და სასტუმროები", x: "0%", y: "0%" },
  { id: "marketing", title: "მარკეტინგი", name: "მარკეტინგი და დიზაინი", x: "-100%", y: "0%" },
  { id: "logistics", title: "ლოგისტიკა", name: "ლოგისტიკა და დისტრიბუცია", x: "-200%", y: "0%" },
  { id: "food", title: "საკვები", name: "საკვები და სასმელი", x: "-300%", y: "0%" },
  { id: "packaging", title: "შეფუთვა", name: "შეფუთვა და წარმოება", x: "0%", y: "-100%" },
  { id: "tourism", title: "ტურიზმი", name: "ტურიზმი", x: "-100%", y: "-100%" },
  { id: "finance", title: "ფინანსები", name: "ბუღალტერია და ფინანსები", x: "-200%", y: "-100%" },
  { id: "technology", title: "ტექნოლოგიები", name: "IT და ტექნოლოგიები", x: "-300%", y: "-100%" },
] as const;

export const sectors = [
  { photo: "hotel-linen.jpg", label: "ტექსტილი და სასტუმროები" },
  { photo: "logistics-warehouse.jpg", label: "ლოგისტიკა და მიწოდება" },
  { photo: "cardboard-packaging.jpg", label: "შეფუთვა და წარმოება" },
  { photo: "fresh-produce.jpg", label: "საკვები და სასმელი" },
] as const;

export const suggestions = [
  { icon: "package", label: "შეფუთვა და ყუთები" },
  { icon: "truck", label: "ტვირთის გადაზიდვა" },
  { icon: "calculator", label: "ბუღალტრული მომსახურება" },
  { icon: "monitor", label: "ვებსაიტის შექმნა" },
] as const;

export type FeaturedCompany = {
  id: string;
  name: string;
  cityLabel: string;
  description: string;
  area: string;
  offerCount: number;
  industryLabel: string;
  collaborationLabels: string[];
  photo: string;
  photoAlt: string;
};

export const featuredCompanies: FeaturedCompany[] = [
  {
    id: "linen",
    name: "Linen House",
    cityLabel: "თბილისი",
    description: "სასტუმროს თეთრეული და ტექსტილი — შენი სტუმრების კომფორტისთვის.",
    area: "თბილისი, ბათუმი",
    offerCount: 3,
    industryLabel: "ტექსტილი და სასტუმროები",
    collaborationLabels: ["გრძელვადიანი", "ერთჯერადი"],
    photo: "hotel-linen.jpg",
    photoAlt: "სასტუმროს ოთახი და თეთრეული",
  },
  {
    id: "studio",
    name: "Forma Studio",
    cityLabel: "თბილისი",
    description: "ბრენდინგი და მარკეტინგი, რომელიც შენს ბიზნესს უკეთ წარმოაჩენს.",
    area: "მთელი საქართველო · დისტანციურად",
    offerCount: 3,
    industryLabel: "მარკეტინგი და დიზაინი",
    collaborationLabels: ["პროექტული", "გრძელვადიანი"],
    photo: "creative-team.jpg",
    photoAlt: "გუნდი შემოქმედებით სამუშაო სივრცეში",
  },
  {
    id: "route",
    name: "Route Logistics",
    cityLabel: "ბათუმი",
    description: "ტვირთის გადაზიდვა და მიწოდების ორგანიზება შენი ბიზნესისთვის.",
    area: "თბილისი, ბათუმი, ქუთაისი",
    offerCount: 3,
    industryLabel: "ლოგისტიკა და დისტრიბუცია",
    collaborationLabels: ["ერთჯერადი", "გრძელვადიანი"],
    photo: "logistics-warehouse.jpg",
    photoAlt: "ლოგისტიკური საწყობის თაროები",
  },
];
