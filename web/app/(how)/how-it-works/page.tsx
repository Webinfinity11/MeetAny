
import { Button } from "../../components/ui/Button";
import Link from "next/link";
import { Icon } from "../../components/Icon";
import { DuoIcon } from "../../components/ui/DuoIcon";

// Facts here follow the terms page and the product rules (request 14 days, +7 extension, offers
// visible to the request author only, contacts after choosing). Update both places together.

const buyerSteps = [
  { frame: 0, title: "მოძებნე ან აღწერე, რა გჭირდება", text: "მოძებნე კომპანია კატალოგში დარგისა და ქალაქის მიხედვით, ან გამოაქვეყნე მოთხოვნა: რა, რამდენი, სად და როდისთვის." },
  { frame: 1, title: "მიიღე და შეადარე შეთავაზებები", text: "შესაბამისი კომპანიები შეტყობინებას იღებენ და გიგზავნიან შეთავაზებას ფასით, მიწოდების ვადითა და პირობებით. შეთავაზებებს მხოლოდ შენ ხედავ." },
  { frame: 2, title: "აირჩიე და შეთანხმდი პირდაპირ", text: "აირჩიე შენთვის სასურველი შეთავაზება, დაუკავშირდი კომპანიას და დეტალები პირდაპირ შეათანხმე." },
];

const companySteps = [
  { icon: "store", title: "დაარეგისტრირე კომპანია", text: "შეავსე პროფილი: დარგი, მომსახურების ქალაქები, აღწერა, ლოგო და ფოტოები. სრული პროფილი კატალოგში მაღლა ჩანს." },
  { icon: "inbox", title: "მიიღე ახალი მოთხოვნები", text: "როცა შენს დარგსა და ქალაქში ახალი მოთხოვნა ჩნდება, შეტყობინებას მიიღებ — ძებნა არ გჭირდება." },
  { icon: "file-text", title: "გაგზავნე შეთავაზება", text: "მიუთითე ფასი — ერთეულის, ჯამური ან შეთანხმებით — მიწოდების ვადა და პირობები." },
  { icon: "handshake", title: "დაიწყე თანამშრომლობა", text: "როცა შენს შეთავაზებას აირჩევენ, საკონტაქტო მონაცემები გაიხსნება და პირდაპირ შეთანხმდებით." },
];

const trust = [
  { icon: "badge-check", title: "დადასტურებული კომპანიები", text: "„დადასტურებული“ ნიშანს MeetAny-ს გუნდი ანიჭებს კომპანიის მონაცემების გადამოწმების შემდეგ." },
  { icon: "lock", title: "შენი კონტაქტი შენს ხელშია", text: "ელფოსტა საჯაროდ არ ჩანს — მეორე მხარე მას მხოლოდ შეთავაზების არჩევის შემდეგ ხედავს." },
  { icon: "shield-check", title: "მოდერაცია", text: "გუნდი ადევნებს თვალს მოთხოვნებსა და პროფილებს. წესების დარღვევისას ჩანაწერი იმალება ან ანგარიში იბლოკება." },
];

const faq = [
  ["რა ღირს MeetAny-ით სარგებლობა?", "რეგისტრაცია, მოთხოვნის გამოქვეყნება და შეთავაზების გაგზავნა უფასოა. გარიგებაზე საკომისიოს არ ვიღებთ — ანგარიშსწორება პირდაპირ მხარეებს შორის ხდება."],
  ["რამდენ ხანს არის მოთხოვნა ღია?", "14 დღე. ავტორს შეუძლია ვადის გაგრძელება 7 დღით ან მოთხოვნის დახურვა ნებისმიერ დროს."],
  ["ვინ ხედავს ჩემს შეთავაზებას?", "შეთავაზების ტექსტსა და ფასს ხედავს მხოლოდ მოთხოვნის ავტორი. სხვა კომპანიები ხედავენ მხოლოდ შეთავაზებების რაოდენობას."],
  ["შემიძლია შეთავაზების შეცვლა ან გაუქმება?", "კი, სანამ ავტორი შეთავაზებას აირჩევს. არჩეული შეთავაზება აღარ უქმდება."],
  ["რა ხდება შეთავაზების არჩევის შემდეგ?", "მოთხოვნის ავტორი და კომპანია ერთმანეთის საკონტაქტო მონაცემებს ხედავენ და პირობებს პირდაპირ თანხმდებიან. მოთხოვნა ახალ შეთავაზებებს აღარ იღებს."],
  ["როგორ მივიღო „დადასტურებული“ ნიშანი?", "სრულად შეავსე კომპანიის პროფილი. MeetAny-ს გუნდი გადაამოწმებს მონაცემებს და ნიშანს მიანიჭებს."],
  ["შემიძლია ანგარიშის წაშლა?", "კი. ნებისმიერ დროს შეგიძლია მოითხოვო ანგარიშისა და მონაცემების წაშლა."],
];

export default function HowItWorksPage() {
  return <>
    <section className="how-hero" aria-labelledby="how-title">
      <div className="home-wrap">
        <h1 id="how-title">როგორ მუშაობს MeetAny</h1>
        <p>ბიზნესები აქ ერთმანეთს ორი გზით პოულობენ: მოძებნე კომპანია ან გამოაქვეყნე მოთხოვნა და შეთავაზებები თავად მოვა.</p>
        <nav className="how-hero__paths" aria-label="აირჩიე შენი გზა">
          <Button variant="base" size="lg" className="how-hero__primary" href="#buyers"><Icon name="search" />მომწოდებელს ვეძებ</Button>
          <Button variant="base" size="lg" className="how-hero__secondary" href="#companies"><Icon name="building-2" />კომპანია ვარ</Button>
        </nav>
      </div>
    </section>

    <section className="how-section home-wrap" id="buyers" aria-labelledby="buyers-title">
      <header className="how-section__head">
        <p className="how-section__eyebrow">მყიდველისთვის</p>
        <h2 id="buyers-title">იპოვე მომწოდებელი სამ ნაბიჯში</h2>
      </header>
      <ol className="how-steps">
        {buyerSteps.map((step, index) => <li key={step.title}>
          <span className="how-steps__art" aria-hidden="true" style={{ backgroundPosition: `${step.frame * 50}% 50%` }} />
          <span className="how-steps__num" aria-hidden="true">{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>)}
      </ol>
      <div className="how-actions">
        <Button variant="primary" size="lg" href="/requests/new/"><Icon name="plus" />მოთხოვნის დამატება</Button>
        <Button variant="secondary" size="lg" href="/companies/">კომპანიების კატალოგი</Button>
      </div>
    </section>

    <section className="how-section how-section--tinted" id="companies" aria-labelledby="companies-title">
      <div className="home-wrap">
        <header className="how-section__head">
          <p className="how-section__eyebrow">კომპანიისთვის</p>
          <h2 id="companies-title">მიიღე შეკვეთები შენს დარგში</h2>
        </header>
        <ol className="how-list">
          {companySteps.map((step, index) => <li key={step.title}>
            <DuoIcon name={step.icon} size={24} tile />
            <div>
              <h3><span aria-hidden="true">{index + 1}.</span> {step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>)}
        </ol>
        <div className="how-actions">
          <Button variant="primary" size="lg" href="/account/?tab=register&role=company"><Icon name="building-2" />კომპანიის რეგისტრაცია</Button>
          <Button variant="secondary" size="lg" href="/requests/">ღია მოთხოვნები</Button>
        </div>
      </div>
    </section>

    <section className="how-section home-wrap" aria-labelledby="trust-title">
      <header className="how-section__head">
        <p className="how-section__eyebrow">ნდობა და უსაფრთხოება</p>
        <h2 id="trust-title">რატომ შეგიძლია ენდო</h2>
      </header>
      <ul className="how-trust">
        {trust.map(item => <li key={item.title}>
          <span className="icon-tile" aria-hidden="true"><Icon name={item.icon} /></span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </li>)}
      </ul>
    </section>

    <section className="how-section home-wrap" aria-labelledby="faq-title">
      <header className="how-section__head">
        <p className="how-section__eyebrow">კითხვები</p>
        <h2 id="faq-title">ხშირად დასმული კითხვები</h2>
      </header>
      <div className="how-faq">
        {faq.map(([question, answer]) => <details key={question}>
          <summary>{question}<Icon name="chevron-down" /></summary>
          <p>{answer}</p>
        </details>)}
      </div>
      <p className="how-faq__more">დეტალურად — <Link href="/terms/">წესები და კონფიდენციალურობა</Link>.</p>
    </section>

    <section className="home-join home-wrap how-join"><div className="home-join__panel">
      <div><h2>მზად ხარ დასაწყებად?</h2><p>აღწერე, რა გჭირდება, ან დაარეგისტრირე კომპანია და მიიღე მოთხოვნები.</p></div>
      <div className="how-join__actions">
        <Button variant="base" size="lg" className="home-join__cta" href="/requests/new/">მოთხოვნის დამატება<Icon name="arrow-right" /></Button>
        <Button variant="base" size="lg" className="how-join__ghost" href="/account/?tab=register&role=company">კომპანიის რეგისტრაცია</Button>
      </div>
    </div></section>
  </>;
}
