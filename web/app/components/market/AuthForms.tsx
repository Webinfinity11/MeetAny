"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";

type Mode = "login" | "register";

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.login(email, password);
      router.refresh();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შესვლა ვერ მოხერხდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit}>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="login-email">
          ელფოსტა
        </label>
        <input className="ma-input" id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ge" />
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="login-password">
          პაროლი
        </label>
        <input className="ma-input" id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="ma-btn ma-btn--primary ma-btn--block" type="submit" disabled={pending}>
        {pending ? "შესვლა…" : "შესვლა"}
      </button>
      <button type="button" className="ma-link" onClick={onSwitch}>
        არ გაქვს ანგარიში? დაარეგისტრირდი
      </button>
    </form>
  );
}

function RegisterForm({ initialRole }: { initialRole: string }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const [role, setRole] = useState(initialRole === "company" ? "company" : "client");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("+995 ");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("tbilisi");
  const [industry, setIndustry] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setPending(true);
    setError(null);
    try {
      await store.register({ role, name, company, phone, email, city, industry, password, acceptTerms });
      router.refresh();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რეგისტრაცია ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit}>
      <fieldset className="ma-field">
        <legend className="ma-field__label">ვინ ხარ?</legend>
        <div className="ma-cluster">
          <label className="ma-check">
            <input type="radio" name="role" checked={role === "client"} onChange={() => setRole("client")} />
            <span>მჭირდება მომსახურება ან პროდუქცია</span>
          </label>
          <label className="ma-check">
            <input type="radio" name="role" checked={role === "company"} onChange={() => setRole("company")} />
            <span>ვთავაზობ მომსახურებას ან პროდუქციას</span>
          </label>
        </div>
      </fieldset>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-name">
            სახელი და გვარი *
          </label>
          <input className="ma-input" id="reg-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-company">
            კომპანია / ობიექტი{role === "client" ? " · არასავალდებულო" : " *"}
          </label>
          <input className="ma-input" id="reg-company" maxLength={100} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      </div>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-phone">
            მობილური ტელეფონი * <span className="ma-field__opt">ნომერი საჯაროდ გამოჩნდება</span>
          </label>
          <input className="ma-input" id="reg-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+995 5XX XXX XXX" />
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-email">
            ელფოსტა *
          </label>
          <input className="ma-input" id="reg-email" type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ge" />
        </div>
      </div>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-city">
            ქალაქი *
          </label>
          <select className="ma-select" id="reg-city" value={city} onChange={(e) => setCity(e.target.value)}>
            {Object.entries(cities).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {role === "company" ? (
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="reg-industry">
              მიმართულება *
            </label>
            <select className="ma-select" id="reg-industry" required value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="" disabled>
                აირჩიე მიმართულება
              </option>
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="reg-password">
          პაროლი * <span className="ma-field__opt">მინიმუმ 8 სიმბოლო</span>
        </label>
        <input className="ma-input" id="reg-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="ma-check">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>ვეთანხმები წესებსა და პერსონალური მონაცემების დამუშავებას</span>
      </label>
      {error ? (
        <p className="ma-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="ma-btn ma-btn--primary ma-btn--block" type="submit" disabled={pending}>
        {pending ? "იქმნება…" : "ანგარიშის შექმნა"}
      </button>
    </form>
  );
}

export function AuthForms({ initialRole = "" }: { initialRole?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  return (
    <section className="ma-panel">
      <nav className="ma-tabs" aria-label="შესვლა ან რეგისტრაცია">
        <button type="button" className="ma-tab" aria-current={mode === "login" ? "page" : undefined} onClick={() => setMode("login")}>
          შესვლა
        </button>
        <button type="button" className="ma-tab" aria-current={mode === "register" ? "page" : undefined} onClick={() => setMode("register")}>
          რეგისტრაცია
        </button>
      </nav>
      {mode === "login" ? <LoginForm onSwitch={() => setMode("register")} /> : <RegisterForm initialRole={initialRole} />}
    </section>
  );
}
