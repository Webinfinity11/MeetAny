// One vocabulary for admin navigation, page titles and presentation links.
export const adminSections = {
  overview: { label: "მიმოხილვა", icon: "layout-grid", description: "პლატფორმის აქტივობა და შემდეგი მოქმედებები" },
  requests: { label: "მოთხოვნები", icon: "clipboard-list", description: "გამოქვეყნებული მოთხოვნები, მათი სტატუსები და ხილვადობის მართვა" },
  companies: { label: "კომპანიები", icon: "building-2", description: "კომპანიების პროფილები, დამტკიცება და ხილვადობის პაკეტები" },
  content: { label: "საიტის შიგთავსი", icon: "image", description: "მთავარი გვერდის ტექსტები და ფოტოები" },
  users: { label: "მომხმარებლები", icon: "users", description: "ყველა ანგარიში და წვდომის მართვა" },
  offers: { label: "შეთავაზებები", icon: "inbox", description: "კომპანიების პასუხები მოთხოვნებზე და მათი სტატუსები" },
  reports: { label: "საჩივრები", icon: "flag", description: "მომხმარებლების საჩივრების განხილვა და დარღვევებზე რეაგირება" },
  reviews: { label: "შეფასებები", icon: "star", description: "გამოქვეყნებული შეფასებების მართვა" },
  plans: { label: "ხილვადობის პაკეტები", icon: "building-2", description: "Premium / VIP განაცხადები და აქტივაციის ვადები" },
  photos: { label: "ფოტოების შემოწმება", icon: "image", description: "კომპანიების ატვირთული ლოგოებისა და გალერეის ფოტოების მართვა" },
  audit: { label: "მოქმედებების ისტორია", icon: "clock", description: "ვინ, როდის და რა შეცვალა ადმინისტრირებისას" },
  contacts: { label: "დაკავშირების სტატისტიკა", icon: "phone", description: "ნომრის ნახვები, დარეკვის ღილაკზე დაჭერები და ახალი მიმოწერები" },
  demo: { label: "სადემო გზამკვლევი", icon: "clipboard-list", description: "მზა სცენარები და განმარტებები კლიენტისთვის MeetAny-ის წარსადგენად" },
} as const;

export type AdminSection = keyof typeof adminSections;
