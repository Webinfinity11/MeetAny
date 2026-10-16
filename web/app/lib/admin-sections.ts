// One vocabulary for admin navigation, page titles and presentation links.
// Visibility plans and the demo guide are outside the MVP: their RPCs and tables stay, the admin hides them.
export const adminSections = {
  overview: { label: "მიმოხილვა", icon: "layout-grid", description: "პლატფორმის აქტივობა და შემდეგი მოქმედებები" },
  requests: { label: "მოთხოვნები", icon: "clipboard-list", description: "გამოქვეყნებული მოთხოვნები, მათი სტატუსები და ხილვადობა" },
  companies: { label: "კომპანიები", icon: "building-2", description: "კომპანიების პროფილები და ვერიფიკაცია" },
  deals: { label: "გარიგებები", icon: "handshake", description: "გარიგებების ეტაპები, პრობლემები და მათი მართვა" },
  offers: { label: "შეთავაზებები", icon: "inbox", description: "მოთხოვნებზე მიღებული შეთავაზებები და მათი სტატუსები" },
  users: { label: "მომხმარებლები", icon: "users", description: "ყველა ანგარიში და წვდომის მართვა" },
  reports: { label: "მომართვები", icon: "flag", description: "საჩივრები და კონტაქტის შეცვლის მოთხოვნები" },
  reviews: { label: "შეფასებები", icon: "star", description: "შეფასებები ქვეყნდება ავტომატურად; საჭიროებისას დამალეთ მიზეზით." },
  content: { label: "საიტის შიგთავსი", icon: "image", description: "კატალოგის ფოტოები (/companies/)" },
  contacts: { label: "კონტაქტები", icon: "phone", description: "ნომრის ნახვები, დარეკვები და ახალი მიმოწერები" },
  photos: { label: "ფოტოები", icon: "image", description: "კომპანიების ატვირთული ლოგოები და გალერეის ფოტოები" },
  audit: { label: "ისტორია", icon: "clock", description: "ვინ, როდის და რა შეცვალა ადმინისტრირებისას" },
} as const;

export type AdminSection = keyof typeof adminSections;
