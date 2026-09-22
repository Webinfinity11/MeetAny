"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";

type Mode = "login" | "register" | "reset";

function LoginForm({ onSwitch, onReset }: { onSwitch: () => void; onReset: () => void }) {
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
      window.dispatchEvent(new Event("meetany:auth"));
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "შესვლა ვერ მოხერხდა.");
      window.dispatchEvent(new Event("meetany:auth"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit}>
      <button type="button" className="ma-btn ma-btn--ghost" onClick={onReset}>პაროლი დაგავიწყდა?</button>
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
  const profileRequired = !!store?.needsProfile();
  const profile = store?.pendingProfile();
  const [role, setRole] = useState(profile?.role || (initialRole === "company" ? "company" : "client"));
  const [name, setName] = useState(profile?.name || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [phone, setPhone] = useState(profile?.phone || "+995 ");
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
      window.dispatchEvent(new Event("meetany:auth"));
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
          <input className="ma-input" id="reg-email" type="email" required={!profileRequired} disabled={profileRequired} maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ge" />
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
        <input className="ma-input" id="reg-password" type="password" required={!profileRequired} disabled={profileRequired} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
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
  const searchParams = useSearchParams();
  const {store} = useMarketStore();
  const [mode, setMode] = useState<Mode>(searchParams.get("tab") === "register" || initialRole ? "register" : "login");
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(n => n + 1);
    window.addEventListener("meetany:auth", update);
    return () => window.removeEventListener("meetany:auth", update);
  }, []);
  if (store?.pendingEmail()) return <RecoveryForm verification onDone={() => refresh(n => n + 1)} />;
  if (store?.needsProfile()) return <section className="ma-panel"><h2>პროფილის დასრულება</h2><RegisterForm initialRole={initialRole}/></section>;
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
      {mode === "reset" ? <RecoveryForm onDone={() => setMode("login")} /> : mode === "login" ? <LoginForm onSwitch={() => setMode("register")} onReset={() => setMode("reset")} /> : <RegisterForm initialRole={initialRole} />}
    </section>
  );
}

function RecoveryForm({ verification = false, onDone }: {verification?: boolean; onDone: () => void}) {
  const {store} = useMarketStore();
  const [email, setEmail] = useState(store?.pendingResetEmail() || "");
  const [sent, setSent] = useState(verification || !!store?.pendingResetEmail());
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!store || pending) return;
    setPending(true); setError("");
    try {
      if (verification) {await store.verifyEmailCode(code); onDone();}
      else if (sent) {await store.resetPassword(code, password); onDone();}
      else {await store.requestPasswordReset(email); setSent(true);}
    } catch (err) {setError((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
    finally {setPending(false);}
  }
  return <form className="ma-form" onSubmit={submit}>
    <h2>{verification ? "ელფოსტის დადასტურება" : "პაროლის აღდგენა"}</h2>
    {!sent ? <label className="ma-field">ელფოსტა<input className="ma-input" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label> : <>
      <p>შეამოწმე ელფოსტა და შეიყვანე მიღებული კოდი.</p>
      <label className="ma-field">კოდი<input className="ma-input" required autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)}/></label>
      {!verification ? <label className="ma-field">ახალი პაროლი<input className="ma-input" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)}/></label> : null}
      <button type="button" className="ma-btn ma-btn--ghost" disabled={pending} onClick={async () => {
        setPending(true); setError("");
        try {if (verification) await store?.resendCode(); else await store?.requestPasswordReset(email); setNotice("კოდი ხელახლა გაიგზავნა.");}
        catch(err) {setError((err as {userMessage?: string}).userMessage || "ვერ გაიგზავნა.");}
        finally {setPending(false);}
      }}>კოდის ხელახლა გაგზავნა</button>
    </>}
    {notice ? <p role="status">{notice}</p> : null}{error ? <p className="ma-field__error" role="alert">{error}</p> : null}
    <button className="ma-btn ma-btn--primary" disabled={pending}>{pending ? "იტვირთება…" : sent ? "დადასტურება" : "კოდის მიღება"}</button>
    {!verification ? <button type="button" className="ma-btn ma-btn--ghost" onClick={onDone}>შესვლაზე დაბრუნება</button> : null}
  </form>;
}
