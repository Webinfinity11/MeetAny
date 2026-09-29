"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore } from "../../lib/market-client";
import { cities } from "../../lib/categories";
import { categoryOptions } from "./CategoryOptions";
import { PageBand } from "./PageBand";
import { isEmail, useFieldErrors, type FieldErrors } from "./fieldErrors";

type Mode = "login" | "register" | "reset";

// "?next=" after sign-in: a same-origin path only ("/x", never "//host" or "/\\host").
function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;
}

const WRONG_LOGIN = "ელფოსტა ან პაროლი არასწორია.";

// Password field with a text "show" toggle inside the control (44px hit area).
export function PasswordInput({ value, onChange, autoComplete, disabled, field }: { value: string; onChange: (value: string) => void; autoComplete: string; disabled?: boolean; field: Record<string, unknown> }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-password">
      <input className="ma-input" type={shown ? "text" : "password"} autoComplete={autoComplete} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} {...field} />
      <button type="button" className="auth-password__toggle" aria-pressed={shown} disabled={disabled} onClick={() => setShown((v) => !v)}>
        {shown ? "დამალვა" : "ჩვენება"}
      </button>
    </div>
  );
}

// Server error above the submit button in a reserved line, so the button never moves.
function FormAlert({ error }: { error: string | null }) {
  return (
    <p className="ma-field__error auth-alert" role="alert">
      {error || ""}
    </p>
  );
}

function LoginForm({ onReset }: { onReset: () => void }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = useFieldErrors();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setError(null);
    const errors: FieldErrors = {};
    if (!isEmail(email)) errors["login-email"] = "ჩაწერე სწორი ელფოსტა";
    if (!password) errors["login-password"] = "მიუთითე პაროლი";
    if (!v.check(errors, ["login-email", "login-password"])) return;
    setPending(true);
    try {
      await store.login(email.trim(), password);
      window.dispatchEvent(new Event("meetany:auth"));
      if (store.currentUser()?.role === "admin") router.replace("/admin/");
      else if (next && store.currentUser()) router.push(next);
      else router.refresh();
    } catch (err) {
      const message = (err as { userMessage?: string })?.userMessage;
      setError(message === "პაროლი არასწორია." ? WRONG_LOGIN : message || "შესვლა ვერ მოხერხდა.");
      window.dispatchEvent(new Event("meetany:auth"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form" onSubmit={submit} noValidate>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="login-email">
          ელფოსტა
        </label>
        <input className="ma-input" autoComplete="username" type="email" inputMode="email" value={email} onChange={(e) => {setEmail(e.target.value); v.clear("login-email");}} {...v.control("login-email")} />
        {v.message("login-email")}
      </div>
      <div className="ma-field">
        <div className="auth-label-row">
          <label className="ma-field__label" htmlFor="login-password">
            პაროლი
          </label>
          <button type="button" className="auth-link" onClick={onReset}>პაროლი დაგავიწყდა?</button>
        </div>
        <PasswordInput autoComplete="current-password" value={password} onChange={(value) => {setPassword(value); v.clear("login-password");}} field={v.control("login-password")} />
        {v.message("login-password")}
      </div>
      <div className="auth-submit">
        <FormAlert error={error} />
        <button className="ma-btn ma-btn--primary ma-btn--block" type="submit" disabled={pending}>
          {pending ? "შესვლა…" : "შესვლა"}
        </button>
      </div>
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
  const v = useFieldErrors();
  const edit = (id: string, set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {set(e.target.value); v.clear(id);};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    setError(null);
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors["reg-name"] = "მიუთითე სახელი და გვარი";
    if (role === "company" && company.trim().length < 2) errors["reg-company"] = "მიუთითე დასახელება";
    if (phone.replace(/\D/g, "").length < 9) errors["reg-phone"] = "ჩაწერე მობილურის ნომერი";
    if (!profileRequired && !isEmail(email)) errors["reg-email"] = "ჩაწერე სწორი ელფოსტა";
    if (role === "company" && !industry) errors["reg-industry"] = "აირჩიე მიმართულება";
    if (!profileRequired && password.length < 8) errors["reg-password"] = password ? "მინიმუმ 8 სიმბოლო" : "მიუთითე პაროლი";
    if (!acceptTerms) errors["reg-terms"] = "რეგისტრაციისთვის დაეთანხმე წესებს";
    if (!v.check(errors, ["reg-name", "reg-company", "reg-phone", "reg-email", "reg-industry", "reg-password", "reg-terms"])) return;
    setPending(true);
    try {
      await store.register({ role, name, company, phone, email: email.trim(), city, industry, password, acceptTerms });
      router.refresh();
      window.dispatchEvent(new Event("meetany:auth"));
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რეგისტრაცია ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form auth-register" onSubmit={submit} noValidate>
      <fieldset className="ma-field">
        <legend className="ma-field__label">ვინ ხარ?</legend>
        <div className="auth-roles">
          <label className="auth-role">
            <input type="radio" name="role" aria-label="მჭირდება მომსახურება ან პროდუქცია" aria-describedby="role-client-title" checked={role === "client"} onChange={() => setRole("client")} />
            <span><strong id="role-client-title">კლიენტი</strong><span>მჭირდება მომსახურება ან პროდუქცია</span></span>
          </label>
          <label className="auth-role">
            <input type="radio" name="role" aria-label="ვთავაზობ მომსახურებას ან პროდუქციას" aria-describedby="role-company-title" checked={role === "company"} onChange={() => setRole("company")} />
            <span><strong id="role-company-title">კომპანია</strong><span>ვთავაზობ მომსახურებას ან პროდუქციას</span></span>
          </label>
        </div>
      </fieldset>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-name">
            სახელი და გვარი *
          </label>
          <input className="ma-input" maxLength={80} autoComplete="name" value={name} onChange={edit("reg-name", setName)} {...v.control("reg-name")} />
          <div className="auth-field-message">{v.message("reg-name")}</div>
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-company">
            კომპანია{role === "client" ? <> <span className="ma-field__opt">არასავალდებულო</span></> : " *"}
          </label>
          <input className="ma-input" maxLength={100} autoComplete="organization" value={company} onChange={edit("reg-company", setCompany)} {...v.control("reg-company")} />
          <div className="auth-field-message">{v.message("reg-company")}</div>
        </div>
      </div>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-phone">
            მობილური ტელეფონი *
          </label>
          <input className="ma-input" type="tel" autoComplete="tel" value={phone} onChange={edit("reg-phone", setPhone)} {...v.control("reg-phone", v.errors["reg-phone"] ? undefined : "reg-phone-help")} />
          <div className="auth-field-message">{v.message("reg-phone") || <p className="ma-field__help" id="reg-phone-help">ნომერი საჯაროდ გამოჩნდება</p>}</div>
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-email">
            ელფოსტა *
          </label>
          <input className="ma-input" type="email" inputMode="email" autoComplete="email" disabled={profileRequired} maxLength={200} value={email} onChange={edit("reg-email", setEmail)} {...v.control("reg-email")} />
          <div className="auth-field-message">{v.message("reg-email")}</div>
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
            <select className="ma-select" value={industry} onChange={edit("reg-industry", setIndustry)} {...v.control("reg-industry")}>
              <option value="" disabled>
                აირჩიე
              </option>
              {categoryOptions()}
            </select>
            <div className="auth-field-message">{v.message("reg-industry")}</div>
          </div>
        ) : null}
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="reg-password">
          პაროლი * <span className="ma-field__opt">მინიმუმ 8 სიმბოლო</span>
        </label>
        <PasswordInput autoComplete="new-password" disabled={profileRequired} value={password} onChange={(value) => {setPassword(value); v.clear("reg-password");}} field={v.control("reg-password")} />
        <div className="auth-field-message">{v.message("reg-password")}</div>
      </div>
      <div className="ma-field">
        <label className="ma-check">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => {setAcceptTerms(e.target.checked); v.clear("reg-terms");}} {...v.control("reg-terms")} />
          <span>ვეთანხმები წესებსა და პერსონალური მონაცემების დამუშავებას</span>
        </label>
        <div className="auth-field-message">{v.message("reg-terms")}</div>
      </div>
      <div className="auth-submit">
        <FormAlert error={error} />
        <button className="ma-btn ma-btn--primary ma-btn--block" type="submit" disabled={pending}>
          {pending ? "იქმნება…" : "ანგარიშის შექმნა"}
        </button>
      </div>
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
  const page = (title: string, body: React.ReactNode) => (
    <div className="ma-page auth-page">
      <PageBand title={title} />
      <section className="auth-form">{body}</section>
    </div>
  );
  if (store?.pendingEmail()) return page("ელფოსტის დადასტურება", <RecoveryForm verification onDone={() => refresh(n => n + 1)} />);
  if (store?.needsProfile()) return page("პროფილის დასრულება", <RegisterForm initialRole={initialRole}/>);
  return page(mode === "register" ? "რეგისტრაცია" : mode === "reset" ? "პაროლის აღდგენა" : "შესვლა", <>
    <nav className="ma-tabs" aria-label="შესვლა ან რეგისტრაცია">
      <button type="button" className="ma-tab" aria-current={mode === "login" ? "page" : undefined} onClick={() => setMode("login")}>
        შესვლა
      </button>
      <button type="button" className="ma-tab" aria-current={mode === "register" ? "page" : undefined} onClick={() => setMode("register")}>
        რეგისტრაცია
      </button>
    </nav>
    {mode === "reset" ? <RecoveryForm onDone={() => setMode("login")} /> : mode === "login" ? <LoginForm onReset={() => setMode("reset")} /> : <RegisterForm initialRole={initialRole} />}
  </>);
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
  const v = useFieldErrors();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!store || pending) return;
    const errors: FieldErrors = {};
    if (!sent && !isEmail(email)) errors["reset-email"] = "ჩაწერე სწორი ელფოსტა";
    if (sent && !code.trim()) errors["reset-code"] = "ჩაწერე ელფოსტით მიღებული კოდი";
    if (sent && !verification && password.length < 8) errors["reset-password"] = password ? "პაროლი მინიმუმ 8 სიმბოლოა" : "მიუთითე ახალი პაროლი";
    if (!v.check(errors, ["reset-email", "reset-code", "reset-password"])) return;
    setPending(true); setError("");
    try {
      if (verification) {await store.verifyEmailCode(code); onDone();}
      else if (sent) {await store.resetPassword(code, password); onDone();}
      else {await store.requestPasswordReset(email.trim()); setSent(true);}
    } catch (err) {setError((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
    finally {setPending(false);}
  }
  return <form className="ma-form" onSubmit={submit} noValidate>
    {!sent ? <div className="ma-field"><label className="ma-field__label" htmlFor="reset-email">ელფოსტა</label><input className="ma-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value); v.clear("reset-email");}} {...v.control("reset-email")}/>{v.message("reset-email")}</div> : <>
      <p className="auth-hint">შეამოწმე ელფოსტა და შეიყვანე მიღებული კოდი.</p>
      <div className="ma-field"><label className="ma-field__label" htmlFor="reset-code">კოდი</label><input className="ma-input" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => {setCode(e.target.value); v.clear("reset-code");}} {...v.control("reset-code")}/>{v.message("reset-code")}</div>
      {!verification ? <div className="ma-field"><label className="ma-field__label" htmlFor="reset-password">ახალი პაროლი</label><PasswordInput autoComplete="new-password" value={password} onChange={value => {setPassword(value); v.clear("reset-password");}} field={v.control("reset-password")}/>{v.message("reset-password")}</div> : null}
      <button type="button" className="auth-link" disabled={pending} onClick={async () => {
        setPending(true); setError("");
        try {if (verification) await store?.resendCode(); else await store?.requestPasswordReset(email); setNotice("კოდი ხელახლა გაიგზავნა.");}
        catch(err) {setError((err as {userMessage?: string}).userMessage || "ვერ გაიგზავნა.");}
        finally {setPending(false);}
      }}>კოდის ხელახლა გაგზავნა</button>
    </>}
    {notice ? <p className="auth-hint" role="status">{notice}</p> : null}
    <div className="auth-submit">
      <FormAlert error={error || null} />
      <button className="ma-btn ma-btn--primary ma-btn--block" disabled={pending}>{pending ? "იტვირთება…" : sent ? "დადასტურება" : "კოდის მიღება"}</button>
    </div>
    {!verification ? <button type="button" className="auth-link" onClick={onDone}>შესვლაზე დაბრუნება</button> : null}
  </form>;
}
