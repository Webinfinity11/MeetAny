import Link from "next/link";
import Image from "next/image";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/Icon";
import styles from "./How.module.css";

const buyerSteps = [
  ["file-text", "აღწერე საჭიროება", "რა, რამდენი, სად და როდისთვის — გამოაქვეყნე მოთხოვნა და მიიღე შესაბამისი კომპანიების შეთავაზებები.", "მოთხოვნა"],
  ["inbox", "მიიღე შეთავაზებები", "შეადარე ფასი, მიწოდების ვადა და პირობები. შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ხედავს.", "შეთავაზება"],
  ["scale", "შეადარე და აირჩიე", "აირჩიე შენთვის სასურველი შეთავაზება. საკონტაქტო მონაცემები მხოლოდ არჩეულ მხარესთან იხსნება.", "არჩევა"],
  ["handshake", "დაიწყე თანამშრომლობა", "შეათანხმე დეტალები პირდაპირ კომპანიასთან და აკონტროლე შესრულება გარიგების გვერდზე.", "გარიგება"],
];
const supplierSteps = [
  ["რეგისტრაცია", "შეავსე კომპანიის პროფილი, საქმიანობის მიმართულება და მომსახურების ქალაქები."],
  ["ვერიფიკაცია", "გადამოწმებისთვის გამოგზავნე ამონაწერი და საგადასახადო ცნობა."],
  ["შესაბამისი მოთხოვნები", "მიიღე შეტყობინებები შენი დარგისა და ქალაქის მოთხოვნებზე."],
  ["შეთავაზება", "მიუთითე ფასი, მიწოდების ვადა და პირობები."],
  ["გარიგება", "შეთავაზების არჩევის შემდეგ დაუკავშირდი მყიდველს და შეათანხმე დეტალები."],
];
const faq = [
  ["რა ღირს MeetAny-ით სარგებლობა?", "რეგისტრაცია, მოთხოვნის გამოქვეყნება და შეთავაზების გაგზავნა უფასოა. გარიგებაზე საკომისიოს არ ვიღებთ — ანგარიშსწორება პირდაპირ მხარეებს შორის ხდება."],
  ["რამდენ ხანს არის მოთხოვნა ღია?", "14 დღე. ავტორს შეუძლია ვადის გაგრძელება 7 დღით ან მოთხოვნის დახურვა ნებისმიერ დროს."],
  ["ვინ ხედავს ჩემს შეთავაზებას?", "შეთავაზების ტექსტსა და ფასს ხედავს მხოლოდ მოთხოვნის ავტორი. სხვა კომპანიები ხედავენ მხოლოდ შეთავაზებების რაოდენობას."],
  ["შემიძლია შეთავაზების შეცვლა ან გაუქმება?", "კი, სანამ ავტორი შეთავაზებას აირჩევს. არჩეული შეთავაზება აღარ უქმდება."],
  ["რა ხდება შეთავაზების არჩევის შემდეგ?", "მოთხოვნის ავტორი და კომპანია ერთმანეთის საკონტაქტო მონაცემებს ხედავენ და პირობებს პირდაპირ თანხმდებიან. მოთხოვნა ახალ შეთავაზებებს აღარ იღებს."],
  ["შემიძლია ანგარიშის წაშლა?", "კი. ნებისმიერ დროს შეგიძლია მოითხოვო ანგარიშისა და მონაცემების წაშლა."],
];

export default function HowItWorksPage() {
  return <div className={`home-wrap ${styles.page}`}>
    <header className={styles.hero}>
      <h1>როგორ მუშაობს MeetAny</h1>
      <p>მოძებნე კომპანია ან გამოაქვეყნე მოთხოვნა — შესაბამისი მომწოდებლები შეთავაზებებს თავად გამოგიგზავნიან.</p>
      <nav className={styles.paths} aria-label="აირჩიე შენი გზა"><Link href="#buyers">მყიდველისთვის</Link><Link href="#suppliers">მომწოდებლისთვის</Link><Link href="#verification">ვერიფიკაცია</Link></nav>
    </header>
    <section className={styles.section} id="buyers" aria-labelledby="buyers-title">
      <p className={styles.eyebrow}>მყიდველისთვის</p><h2 id="buyers-title">ერთი მოთხოვნიდან — გარიგებამდე</h2>
      <ol className={styles.steps}>{buyerSteps.map(([icon, title, text, meta], i) => <li key={title}>
        <div className={styles.stepHead}><span className={styles.stepIcon}><Icon name={icon} /></span><span className={styles.connector} /></div>
        <div><p className={styles.number}>0{i + 1}</p><h3>{title}</h3><p>{text}</p><span className={styles.meta}>{meta}</span></div>
      </li>)}</ol>
    </section>
    <section className={styles.supplier} id="suppliers" aria-labelledby="companies">
      <div className={styles.supplierCopy}><p className={styles.eyebrow}>მომწოდებლისთვის</p><h2 id="companies">მიიღე შეკვეთები შენს დარგში</h2>
        <ol>{supplierSteps.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>
      </div><div className={styles.photo}><Image unoptimized src="/assets/photos/hero-partners.jpg" alt="" width={1200} height={800} /></div>
    </section>
    <section className={styles.section} id="verification" aria-labelledby="trust-title">
      <p className={styles.eyebrow}>ნდობა და უსაფრთხოება</p><h2 id="trust-title">ვერიფიკაცია</h2>
      <div className={styles.cards}><article className={styles.card}><Icon name="file-text" /><h3>რა დოკუმენტებია საჭირო</h3><p>ვერიფიკაციისთვის გამოგვიგზავნე კომპანიის ამონაწერი და საგადასახადო ცნობა.</p><Link href="/terms/#contact">მხარდაჭერასთან დაკავშირება</Link></article>
        <article className={styles.card}><Icon name="badge-check" /><h3>განხილვა და დადასტურება</h3><p>განხილვა 1–2 სამუშაო დღე გრძელდება. მონაცემების გადამოწმების შემდეგ გუნდი კომპანიას „დადასტურებული“ ნიშნით აღნიშნავს კატალოგსა და პროფილზე.</p></article></div>
      <aside className={styles.contact}><Icon name="lock" /><div><h3>კონტაქტის წესი</h3><p>ტელეფონი და ელფოსტა ჩანს მხოლოდ იმ მხარისთვის, ვისთანაც შეთავაზება აირჩა (გარიგებაში).</p></div></aside>
    </section>
    <section className={styles.section} aria-labelledby="faq-title"><h2 id="faq-title">ხშირად დასმული კითხვები</h2><div className={styles.faq}>{faq.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron-down" /></summary><p>{answer}</p></details>)}</div><Link className={styles.more} href="/terms/">წესები და კონფიდენციალურობა</Link></section>
    <section className={styles.cta}><div><h2>დაიწყე MeetAny-ზე</h2><p>აღწერე საჭიროება ან შესთავაზე კომპანიებს შენი პროდუქტი და მომსახურება.</p></div><div className={styles.actions}><Button size="lg" href="/requests/new/">მოთხოვნის განთავსება</Button><Button variant="secondary" size="lg" href="/account/?tab=register&role=company">კომპანიის რეგისტრაცია</Button></div></section>
  </div>;
}
