"use client";
import "../../styles/pages/account.css";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";


import { CustomSelect } from "../ui/CustomSelect";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore } from "../../lib/market-client";
import { cities } from "../../lib/categories";
import { categoryOptions } from "./CategoryOptions";
import { isEmail, useFieldErrors, type FieldErrors } from "./fieldErrors";

type Mode = "login" | "register" | "reset";

import { safeNext } from "../../lib/auth-redirect";
import { trackRegistration } from "../../lib/registration-telemetry";

import { loginAccount } from "./request/loginAccount";

// Password visibility toggle retains a 44px hit area and an accessible name.
export function PasswordInput({ value, onChange, autoComplete, disabled, field }: { value: string; onChange: (value: string) => void; autoComplete: string; disabled?: boolean; field: Record<string, unknown> }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-password auth-input-icon">
      <Icon name="lock-keyhole" />
      <input className="ma-input" type={shown ? "text" : "password"} autoComplete={autoComplete} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} {...field} />
      <button type="button" className="auth-password__toggle" aria-pressed={shown} aria-label={shown ? "პაროლის დამალვა" : "პაროლის ჩვენება"} disabled={disabled} onClick={() => setShown((v) => !v)}>
        <Icon name={shown ? "eye-off" : "eye"} />
      </button>
    </div>
  );
}

// Display server errors immediately above the submit button.
function FormAlert({ error }: { error: string | null }) {
  return (
    <p className="ma-field__error auth-alert" role="alert">
      {error || ""}
    </p>
  );
}

export function LoginForm({ onReset, onSuccess }: { onReset: () => void; onSuccess?: () => void }) {
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
      await loginAccount(store, email, password);
      if (onSuccess) onSuccess();
      else if (store.currentUser()?.role === "admin") router.replace("/admin/");
      else if (next && store.currentUser()) router.push(next);
      else router.refresh();
    } catch (err) {
      const message = (err as { userMessage?: string })?.userMessage;
      setError(message || "შესვლა ვერ მოხერხდა.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ma-form auth-controls" onSubmit={submit} noValidate>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="login-email">
          ელფოსტა
        </label>
        <div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" autoComplete="username" type="email" inputMode="email" value={email} onChange={(e) => {setEmail(e.target.value); v.clear("login-email");}} {...v.control("login-email")} /></div>
        {v.message("login-email")}
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="login-password">
          პაროლი
        </label>
        <PasswordInput autoComplete="current-password" value={password} onChange={(value) => {setPassword(value); v.clear("login-password");}} field={v.control("login-password")} />
        {v.message("login-password")}
        <button type="button" className="auth-link auth-forgot" onClick={onReset}>დაგავიწყდათ?</button>
      </div>
      <div className="auth-submit">
        <FormAlert error={error} />
        <Button variant="primary" className="ma-btn--block" type="submit" disabled={pending}>
          {pending ? "შესვლა…" : "შესვლა"}
        </Button>
      </div>
    </form>
  );
}

function RegisterForm({ initialRole }: { initialRole: string }) {
  const { store } = useMarketStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const profileRequired = !!store?.needsProfile();
  const profile = store?.pendingProfile();
  const [role] = useState(profile?.role || (initialRole === "company" ? "company" : "client"));
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
  useEffect(() => { trackRegistration(role, "form_open"); }, [role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    trackRegistration(role, "form_started");
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
    trackRegistration(role, "form_submitted");
    setPending(true);
    try {
      await store.register({ role, name, company, phone, email: email.trim(), city, industry, password, acceptTerms });
      if (store.currentUser()) trackRegistration(role, "profile_created");
      else if (store.pendingEmail()) trackRegistration(role, "email_pending");
      if (store.currentUser()?.role === "company") router.push("/onboarding/?step=type");
      else if (next && store.currentUser()) router.push(next);
      else router.refresh();
      window.dispatchEvent(new Event("meetany:auth"));
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რეგისტრაცია ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  const nameField = (
    <div className="ma-field">
      <label className="ma-field__label" htmlFor="reg-name">
        {role === "company" ? "საკონტაქტო პირი (სახელი და გვარი) *" : "სახელი და გვარი *"}
      </label>
      <input className="ma-input" maxLength={80} autoComplete="name" value={name} onChange={edit("reg-name", setName)} {...v.control("reg-name")} />
      <div className="auth-field-message">{v.message("reg-name")}</div>
    </div>
  );
  const companyField = (
    <div className="ma-field">
      <label className="ma-field__label" htmlFor="reg-company">
        {role === "company" ? "კომპანიის დასახელება" : "კომპანია"}{role === "client" ? <> <span className="ma-field__opt">არასავალდებულო</span></> : " *"}
      </label>
      <input className="ma-input" maxLength={100} autoComplete="organization" value={company} onChange={edit("reg-company", setCompany)} {...v.control("reg-company")} />
      <div className="auth-field-message">{v.message("reg-company")}</div>
    </div>
  );

  return (
    <form className="ma-form auth-controls auth-register" onSubmit={submit} onChange={() => trackRegistration(role, "form_started")} noValidate>
      <div className="ma-form__row ma-form__row--2">
        {role === "company" ? <>{companyField}{nameField}</> : <>{nameField}{companyField}</>}
      </div>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-phone">
            მობილური ტელეფონი *
          </label>
          <input className="ma-input" type="tel" autoComplete="tel" value={phone} onChange={edit("reg-phone", setPhone)} {...v.control("reg-phone", v.errors["reg-phone"] ? undefined : "reg-phone-help")} />
          <div className="auth-field-message">{v.message("reg-phone") || <p className="ma-field__help" id="reg-phone-help">ნომერი ჩანს მხოლოდ გარიგების მხარისთვის</p>}</div>
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-email">
            ელფოსტა *
          </label>
          <div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" type="email" inputMode="email" autoComplete="email" disabled={profileRequired} maxLength={200} value={email} onChange={edit("reg-email", setEmail)} {...v.control("reg-email")} /></div>
          <div className="auth-field-message">{v.message("reg-email")}</div>
        </div>
      </div>
      <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-city">
            ქალაქი *
          </label>
          <CustomSelect className="ma-select" id="reg-city" value={city} onChange={(e) => setCity(e.target.value)}>
            {Object.entries(cities).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </CustomSelect>
        </div>
        {role === "company" ? (
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="reg-industry">
              მიმართულება *
            </label>
            <CustomSelect className="ma-select" value={industry} onChange={edit("reg-industry", setIndustry)} {...v.control("reg-industry")}>
              <option value="" disabled>
                აირჩიე
              </option>
              {categoryOptions()}
            </CustomSelect>
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
          <span>ვეთანხმები <a href="/terms/" target="_blank" rel="noopener noreferrer">წესებსა და პერსონალური მონაცემების დამუშავებას</a></span>
        </label>
        <div className="auth-field-message">{v.message("reg-terms")}</div>
      </div>
      <div className="auth-submit">
        <FormAlert error={error} />
        <Button variant="primary" className="ma-btn--block" type="submit" disabled={pending}>
          {pending ? "იქმნება…" : "ანგარიშის შექმნა"}
        </Button>
      </div>
    </form>
  );
}

export function AuthForms({ initialRole = "" }: { initialRole?: string }) {
  const searchParams = useSearchParams();
  const {store} = useMarketStore();
  const mode: Mode = searchParams.get("tab") === "reset" ? "reset" : searchParams.get("tab") === "register" || initialRole ? "register" : "login";
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(n => n + 1);
    window.addEventListener("meetany:auth", update);
    return () => window.removeEventListener("meetany:auth", update);
  }, []);
  const switchMode = (next: Mode, role?: "client" | "company") => {
    const url = new URL(window.location.href);
    if (next === "login") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    if (next !== "register") url.searchParams.delete("role");
    else url.searchParams.set("role", role || "client");
    window.history.pushState(null, "", url.pathname + url.search);
  };
  const registrationRole = searchParams.get("role") || initialRole;
  const isCompany = registrationRole === "company";
  const subtitle = mode === "register" ? isCompany ? "ანგარიში იქმნება წუთში — დანარჩენს onboarding-ში შეავსებთ." : "რამდენიმე ველი — და მოთხოვნის განთავსება შეგიძლიათ." : mode === "reset" ? "მიიღე კოდი ელფოსტაზე და დააყენე ახალი პაროლი." : "კეთილი იყოს შენი დაბრუნება.";
  const page = (title: string, body: React.ReactNode, lead = subtitle) => (
    <div className="ma-page auth-page">
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="auth-title">{title}</h1>
          <p className="auth-lead">{lead}</p>
          <div className="auth-form">{body}</div>
          <p className="auth-note"><Icon name="shield-check" />ერთი ანგარიში — ყიდვაც და გაყიდვაც</p>
        </section>
      </div>
    </div>
  );
  if (store?.pendingEmail()) return page("ელფოსტის დადასტურება", <RecoveryForm verification onDone={() => refresh(n => n + 1)} />, "შეიყვანე ელფოსტაზე მიღებული კოდი.");
  if (store?.needsProfile()) return page("პროფილის დასრულება", <RegisterForm initialRole={initialRole}/>, "დარჩა რამდენიმე დეტალი.");
  return page(mode === "register" ? isCompany ? "კომპანიის რეგისტრაცია" : "კლიენტის რეგისტრაცია" : mode === "reset" ? "პაროლის აღდგენა" : searchParams.get("next") ? "შედით, რომ გააგრძელოთ" : "შესვლა", <>
    {mode === "reset" ? <RecoveryForm onDone={() => switchMode("login")} /> : mode === "login" ? <LoginForm onReset={() => switchMode("reset")} /> : <RegisterForm key={registrationRole} initialRole={registrationRole} />}
    {mode !== "reset" && <div className="auth-registration">
      {mode === "login" ? <>
        <p>ჯერ არ გაქვთ ანგარიში? <button type="button" onClick={() => switchMode("register", "company")}>კომპანიის რეგისტრაცია</button></p>
        <p><button type="button" onClick={() => switchMode("register", "client")}>კლიენტის რეგისტრაცია</button></p>
      </> : <>
        <p>{isCompany ? "კლიენტი ხართ?" : "კომპანია ხართ?"} <button type="button" onClick={() => switchMode("register", isCompany ? "client" : "company")}>{isCompany ? "კლიენტის რეგისტრაცია" : "კომპანიის რეგისტრაცია"}</button></p>
        <p>უკვე გაქვთ ანგარიში? <button type="button" onClick={() => switchMode("login")}>შესვლა</button></p>
      </>}
    </div>}
  </>);
}

function RecoveryForm({ verification = false, onDone }: {verification?: boolean; onDone: () => void}) {
  const router = useRouter();
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
      if (verification) {await store.verifyEmailCode(code); trackRegistration(store.currentUser()?.role, "profile_created"); if (store.currentUser()?.role === "company") router.push("/onboarding/?step=type"); onDone();}
      else if (sent) {await store.resetPassword(code, password); onDone();}
      else {await store.requestPasswordReset(email.trim()); setSent(true);}
    } catch (err) {setError((err as {userMessage?: string}).userMessage || "ვერ შესრულდა.");}
    finally {setPending(false);}
  }
  return <form className="ma-form auth-controls" onSubmit={submit} noValidate>
    {!sent ? <div className="ma-field"><label className="ma-field__label" htmlFor="reset-email">ელფოსტა</label><div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value); v.clear("reset-email");}} {...v.control("reset-email")}/></div>{v.message("reset-email")}</div> : <>
      <p className="auth-hint">შეამოწმე ელფოსტა და შეიყვანე მიღებული კოდი.</p>
      <div className="ma-field"><label className="ma-field__label" htmlFor="reset-code">კოდი</label><div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => {setCode(e.target.value); v.clear("reset-code");}} {...v.control("reset-code")}/></div>{v.message("reset-code")}</div>
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
      <Button variant="primary" className="ma-btn--block" type="submit" disabled={pending}>{pending ? "იტვირთება…" : sent ? "დადასტურება" : "კოდის მიღება"}</Button>
    </div>
    {!verification ? <button type="button" className="auth-link" onClick={onDone}>შესვლაზე დაბრუნება</button> : null}
  </form>;
}
