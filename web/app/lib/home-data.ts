export const categories = [
  { id: "suppliers", title: "მომწოდებელი", sub: "პროდუქტი და წარმოება", icon: "package" },
  { id: "services", title: "მომსახურება", sub: "მომსახურების კომპანიები", icon: "briefcase-business" },
  { id: "distributors", title: "დისტრიბუტორი", sub: "მიწოდება და დისტრიბუცია", icon: "truck" },
  { id: "partners", title: "ბიზნესპარტნიორი", sub: "საქმიანი თანამშრომლობა", icon: "handshake" },
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

/** Buyer steps: one text on the home page and on /how-it-works/ (meta is the chip shown there). */
export const buyerSteps = [
  { icon: "file-text", title: "აღწერეთ საჭიროება", text: "მიუთითეთ, რა, რამდენი, სად და როდის გჭირდებათ.", meta: "მოთხოვნა" },
  { icon: "inbox", title: "მიიღეთ შეთავაზებები", text: "შესაბამისი მომწოდებლები გიგზავნიან ფასს, ვადას და პირობებს.", meta: "შეთავაზება" },
  { icon: "scale", title: "შეადარეთ და აირჩიეთ", text: "აირჩიეთ საუკეთესო შეთავაზება — კონტაქტი ამის შემდეგ იხსნება.", meta: "არჩევა" },
  { icon: "handshake", title: "შეათანხმეთ გარიგება", text: "დაადასტურეთ პირობები, მიჰყევით შესრულებას და შეაფასეთ.", meta: "გარიგება" },
] as const;

/** "Why MeetAny": the three rules the site enforces (verification, sealed contact, deal-only reviews). */
export const homeRules = [
  { icon: "badge-check", title: "მხოლოდ გადამოწმებული კომპანიები", text: "კომპანია შეთავაზებას მხოლოდ მაშინ აგზავნის, როცა ადმინისტრატორი მის დოკუმენტებს გადაამოწმებს." },
  { icon: "lock", title: "კონტაქტი — არჩევის შემდეგ", text: "ტელეფონი და ელფოსტა იხსნება მხოლოდ თქვენსა და არჩეულ მომწოდებელს შორის." },
  { icon: "star", title: "შეფასება — დასრულებული გარიგებიდან", text: "შეფასებას ტოვებს მხოლოდ ის, ვისთანაც გარიგება ბოლომდე მივიდა." },
] as const;

/** Short home FAQ; every answer describes what the site actually does (see /terms/ and /how-it-works/). */
export const homeFaq = [
  ["უფასოა?", "მოთხოვნის განთავსება და შეთავაზების გაგზავნა უფასოა."],
  ["როგორ ხდება ვერიფიკაცია?", "კომპანია ტვირთავს რეგისტრაციის ამონაწერსა და საგადასახადო დოკუმენტს. ადმინისტრატორი მათ გადაამოწმებს და კომპანია „დადასტურებული“ ნიშნით ჩნდება."],
  ["როდის მოდის შეთავაზებები?", "მოთხოვნა 14 დღე ღიაა. შესაბამისი დარგის მომწოდებლები საიტზე მაშინვე იღებენ შეტყობინებას და შეთავაზებებს ამ ვადაში გიგზავნიან."],
  ["როდის იხსნება კონტაქტი?", "შეთავაზების არჩევის შემდეგ — მხოლოდ თქვენთვის და არჩეული მომწოდებლისთვის. მანამდე საკონტაქტო მონაცემები არავის უჩანს."],
  ["ვინ ხედავს ჩემს მოთხოვნას?", "მოთხოვნა საჯაროა, რომ მომწოდებლებმა იპოვონ. შეთავაზებების შინაარსს და ფასს კი მხოლოდ თქვენ და ადმინისტრატორი ხედავთ."],
] as const;
