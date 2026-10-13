"use client";
import "../../styles/pages/account.css";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";


import { CustomSelect } from "../ui/CustomSelect";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { cities } from "../../lib/categories";
import { normalizeMobilePhone } from "../../lib/mobile-phone";
import { CategoryChips } from "../ui/CategoryChips";
import { isEmail, useFieldErrors, type FieldErrors } from "./fieldErrors";

type Mode = "login" | "register" | "reset";

import { authMode, authLoginCopy, safeNext } from "../../lib/auth-redirect";
import { trackRegistration } from "../../lib/registration-telemetry";

import { loginAccount } from "./request/loginAccount";

// Password visibility toggle retains a 44px hit area and an accessible name.
export function PasswordInput({ value, onChange, autoComplete, disabled, field }: { value: string; onChange: (value: string) => void; autoComplete: string; disabled?: boolean; field: Record<string, unknown> }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-password auth-input-icon">
      <Icon name="lock-keyhole" />
      <input className="ma-input" type={shown ? "text" : "password"} autoComplete={autoComplete} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} {...field} />
      <button type="button" className="auth-password__toggle" aria-pressed={shown} aria-label={shown ? "დამალეთ პაროლი" : "აჩვენეთ პაროლი"} disabled={disabled} onClick={() => setShown((v) => !v)}>
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
    if (!isEmail(email)) errors["login-email"] = "ჩაწერეთ სწორი ელფოსტა";
    if (!password) errors["login-password"] = "მიუთითეთ პაროლი";
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
        <button type="button" className="auth-link auth-forgot" onClick={onReset}>აღადგინეთ პაროლი</button>
      </div>
      <div className="auth-submit">
        <FormAlert error={error} />
        <Button variant="primary" className="ma-btn--block" type="submit" disabled={pending}>
          {pending ? "მიმდინარეობს შესვლა…" : "შედით"}
        </Button>
      </div>
    </form>
  );
}

// Seed controlled fields from the parent’s loaded store on the first render.
// A separate hook starts undefined and loses pending details when this form remounts.
function RegisterForm({ initialRole, store, onSubmitted }: { initialRole: string; store: Store; onSubmitted?: () => void }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const profileRequired = !!store?.needsProfile();
  const profile = store?.pendingProfile();
  const [role, setRole] = useState(profile?.role || (initialRole === "company" ? "company" : "client"));
  const [name, setName] = useState(profile?.name || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [phone, setPhone] = useState(profile?.phone || "+995 ");
  const [email, setEmail] = useState(profile?.email || "");
  const [city, setCity] = useState(profile?.city || "");
  const [industry, setIndustry] = useState(profile?.industry || "");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(!!profile?.acceptTerms);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(store?.profileCompletionError?.() || null);
  const v = useFieldErrors();
  const summary = useRef<HTMLDivElement>(null);
  const edit = (id: string, set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {set(e.target.value); v.clear(id);};
  useEffect(() => { trackRegistration(role, "form_open"); }, [role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || pending) return;
    trackRegistration(role, "form_started");
    setError(null);
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors["reg-name"] = "მიუთითეთ სახელი და გვარი";
    if (role === "company" && company.trim().length < 2) errors["reg-company"] = "მიუთითეთ დასახელება";
    if (!normalizeMobilePhone(phone)) errors["reg-phone"] = "ჩაწერეთ მობილურის ნომერი";
    if (!profileRequired && !isEmail(email)) errors["reg-email"] = "ჩაწერეთ სწორი ელფოსტა";
    if (role === "company" && !industry) errors["reg-industry"] = "აირჩიეთ დარგი";
    if (!profileRequired && password.length < 8) errors["reg-password"] = password ? "მინიმუმ 8 სიმბოლო" : "მიუთითეთ პაროლი";
    if (!city) errors["reg-city"] = "აირჩიეთ ქალაქი";
    if (!acceptTerms) errors["reg-terms"] = "რეგისტრაციისთვის დაეთანხმეთ წესებს";
    if (!v.check(errors, Object.keys(errors))) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    trackRegistration(role, "form_submitted");
    setPending(true);
    try {
      await store.register({ role, name, company: role === "company" ? company : "", phone, email: email.trim(), city, industry, password, acceptTerms });
      onSubmitted?.();
      if (store.currentUser()) trackRegistration(role, "profile_created");
      else if (store.pendingEmail()) trackRegistration(role, "email_pending");
      // Publish the new session before navigating: auth listeners may rerender this form away.
      window.dispatchEvent(new Event("meetany:auth"));
      if (store.currentUser()?.role === "company") router.replace("/onboarding/?step=type");
      else if (next && store.currentUser()) router.push(next);
      else router.refresh();
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "რეგისტრაცია ვერ შესრულდა.");
    } finally {
      setPending(false);
    }
  }

  const nameField = (
    <div className="ma-field">
      <label className="ma-field__label" htmlFor="reg-name">
        {role === "company" ? "საკონტაქტო პირი *" : "სახელი და გვარი *"}
      </label>
      <input className="ma-input" autoFocus={role === "client"} maxLength={80} autoComplete="name" value={name} onChange={edit("reg-name", setName)} {...v.control("reg-name")} />
      <div className="auth-field-message">{v.message("reg-name")}</div>
    </div>
  );
  const companyField = (
    <div className="ma-field">
      <label className="ma-field__label" htmlFor="reg-company">
        კომპანიის დასახელება *
      </label>
      <input className="ma-input" autoFocus maxLength={100} autoComplete="organization" value={company} onChange={edit("reg-company", setCompany)} {...v.control("reg-company")} />
      <div className="auth-field-message">{v.message("reg-company")}</div>
    </div>
  );

  return (
    <form className="ma-form auth-controls auth-register" onSubmit={submit} onChange={() => trackRegistration(role, "form_started")} noValidate>
      <div className="auth-role-switch" role="group" aria-label="ანგარიშის ტიპი">
        {([['client', 'ვეძებ მომწოდებელს'], ['company', 'კომპანია ვარ']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={role === value} onClick={() => {setRole(value); v.check({}, []);}}>{label}</button>)}
      </div>
      {Object.keys(v.errors).length > 0 && <div className="auth-error-summary" ref={summary} role="alert" tabIndex={-1}>
        <strong>შეავსეთ {Object.keys(v.errors).length} ველი</strong>
        <ul>{Object.entries(v.errors).map(([id, message]) => <li key={id}><a href={`#${id}`} onClick={event => {event.preventDefault(); const field = document.getElementById(id); field?.scrollIntoView({block: 'center'}); (field?.matches('input,button') ? field : field?.querySelector<HTMLElement>('button,input'))?.focus();}}>{message}</a></li>)}</ul>
      </div>}
      <fieldset className="auth-register-group">
        <legend>{role === "company" ? "კომპანიის მონაცემები" : "პირადი მონაცემები"}</legend>
        <div className={`ma-form__row${role === "company" ? " ma-form__row--2" : ""}`}>
          {role === "company" ? <>{companyField}{nameField}</> : nameField}
        </div>
      </fieldset>
      <fieldset className="auth-register-group">
        <legend>კონტაქტი</legend>
        <div className="ma-form__row ma-form__row--2">
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-phone">
            მობილური ტელეფონი *
          </label>
          <input className="ma-input" type="tel" autoComplete="tel" value={phone} onChange={edit("reg-phone", setPhone)} {...v.control("reg-phone")} />
          <div className="auth-field-message">{v.message("reg-phone")}</div>
        </div>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-email">
            ელფოსტა *
          </label>
          <div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" type="email" inputMode="email" autoComplete="email" disabled={profileRequired} maxLength={200} value={email} onChange={edit("reg-email", setEmail)} {...v.control("reg-email")} /></div>
          <div className="auth-field-message">{v.message("reg-email")}</div>
        </div>
        </div>
      </fieldset>
      <fieldset className="auth-register-group">
        <legend>{role === "company" ? "საქმიანობა" : "ლოკაცია"}</legend>
        <div className={`ma-form__row${role === "company" ? " ma-form__row--2" : ""}`}>
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="reg-city">
            ქალაქი *
          </label>
          <div><CustomSelect className="ma-select" {...v.control("reg-city")} value={city} onChange={(e) => {setCity(e.target.value); v.clear("reg-city");}}>
            <option value="" disabled>აირჩიეთ ქალაქი</option>
            {Object.entries(cities).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </CustomSelect></div>
          {v.message("reg-city")}
        </div>
        {role === "company" ? (
          <div className="ma-field auth-category-field">
            <label className="ma-field__label" htmlFor="reg-industry">
              დარგი *
            </label>
            <CategoryChips id="reg-industry" label="დარგი" compact value={industry ? [industry] : []} onChange={value => {setIndustry(value[0] || ""); v.clear("reg-industry");}} />
            <div className="auth-field-message">{v.message("reg-industry")}</div>
          </div>
        ) : null}
        </div>
      </fieldset>
      {!profileRequired ? <div className="ma-field">
        <label className="ma-field__label" htmlFor="reg-password">
          პაროლი * <span className="ma-field__opt">მინიმუმ 8 სიმბოლო</span>
        </label>
        <PasswordInput autoComplete="new-password" disabled={profileRequired} value={password} onChange={(value) => {setPassword(value); v.clear("reg-password");}} field={v.control("reg-password")} />
        <div className="auth-field-message">{v.message("reg-password")}</div>
      </div> : null}
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
          {pending ? "იქმნება…" : profileRequired ? "დაასრულეთ რეგისტრაცია" : "დარეგისტრირდით"}
        </Button>
      </div>
    </form>
  );
}

export function AuthForms({ initialRole = "" }: { initialRole?: string }) {
  const searchParams = useSearchParams();
  const {store} = useMarketStore();
  const mode: Mode = authMode(searchParams.get("tab"));
  const [, refresh] = useState(0);
  const [editingEmail, setEditingEmail] = useState(false);
  useEffect(() => {
    const update = () => refresh(n => n + 1);
    window.addEventListener("meetany:auth", update);
    return () => window.removeEventListener("meetany:auth", update);
  }, []);
  const switchMode = (next: Mode, role?: "client" | "company") => {
    const url = new URL(window.location.href);
    if (next === "login") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    if (role) url.searchParams.set("role", role);
    window.history.pushState(null, "", url.pathname + url.search);
  };
  const registrationRole = searchParams.get("role") || initialRole;
  const loginCopy = authLoginCopy(searchParams.get("intent"), searchParams.get("context"), searchParams.get("next"));
  const subtitle = mode === "register" ? "აირჩიეთ ანგარიშის ტიპი და შეავსეთ მონაცემები." : mode === "reset" ? "მიიღეთ კოდი ელფოსტაზე და დააყენეთ ახალი პაროლი." : loginCopy.lead;
  const page = (title: string, body: React.ReactNode, lead = subtitle) => (
    <div className={`ma-page auth-page${(mode === "register" && (!store?.pendingEmail() || editingEmail)) || store?.needsProfile() ? " auth-page--register" : ""}`}>
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="auth-title">{title}</h1>
          <p className="auth-lead">{lead}</p>
          <div className="auth-form">{body}</div>
        </section>
      </div>
    </div>
  );
  if (store?.pendingEmail() && !editingEmail) return page("ელფოსტის დადასტურება", <RecoveryForm verification onChangeEmail={() => {setEditingEmail(true); switchMode("register");}} onDone={() => refresh(n => n + 1)} />, "შეიყვანეთ ელფოსტაზე მიღებული კოდი.");
  if (store?.needsProfile()) return page("რეგისტრაციის დასრულება", <RegisterForm key={store.pendingProfile()?.email || "complete"} initialRole={initialRole} store={store}/>, "შეამოწმეთ მონაცემები და დაასრულეთ რეგისტრაცია.");
  return page(mode === "register" ? "რეგისტრაცია" : mode === "reset" ? "პაროლის აღდგენა" : loginCopy.title, <>
    {mode === "reset" ? <RecoveryForm onDone={() => switchMode("login")} /> : mode === "login" ? <LoginForm onReset={() => switchMode("reset")} /> : store ? <RegisterForm initialRole={registrationRole} store={store} onSubmitted={() => setEditingEmail(false)} /> : null}
    {mode !== "reset" && <div className="auth-registration">
      {mode === "login" ? <>
        <p>ჯერ არ გაქვთ ანგარიში? <button type="button" onClick={() => switchMode("register", "client")}>დარეგისტრირდით</button></p>
        <p>კომპანია არ გაქვთ? <button type="button" onClick={() => switchMode("register", "company")}>დაარეგისტრირეთ კომპანია</button></p>
      </> : <>
        <p>უკვე გაქვთ ანგარიში? <button type="button" onClick={() => switchMode("login")}>შედით</button></p>
      </>}
    </div>}
  </>);
}

function RecoveryForm({ verification = false, onDone, onChangeEmail }: {verification?: boolean; onDone: () => void; onChangeEmail?: () => void}) {
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
    if (!sent && !isEmail(email)) errors["reset-email"] = "ჩაწერეთ სწორი ელფოსტა";
    if (sent && !code.trim()) errors["reset-code"] = "ჩაწერეთ ელფოსტით მიღებული კოდი";
    if (sent && !verification && password.length < 8) errors["reset-password"] = password ? "პაროლი მინიმუმ 8 სიმბოლოა" : "მიუთითეთ ახალი პაროლი";
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
      <p className="auth-hint">კოდი გაიგზავნა ელფოსტაზე: <strong>{verification ? store?.pendingEmail() : email || store?.pendingResetEmail()}</strong>. შეიყვანეთ მიღებული კოდი.</p>
      {verification && onChangeEmail ? <button type="button" className="auth-link" disabled={pending} onClick={onChangeEmail}>შეცვალეთ ელფოსტა</button> : null}
      <div className="ma-field"><label className="ma-field__label" htmlFor="reset-code">კოდი</label><div className="auth-input-icon"><Icon name="mail" /><input className="ma-input" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => {setCode(e.target.value); v.clear("reset-code");}} {...v.control("reset-code")}/></div>{v.message("reset-code")}</div>
      {!verification ? <div className="ma-field"><label className="ma-field__label" htmlFor="reset-password">ახალი პაროლი</label><PasswordInput autoComplete="new-password" value={password} onChange={value => {setPassword(value); v.clear("reset-password");}} field={v.control("reset-password")}/>{v.message("reset-password")}</div> : null}
      <button type="button" className="auth-link" disabled={pending} onClick={async () => {
        setPending(true); setError("");
        try {if (verification) await store?.resendCode(); else await store?.requestPasswordReset(email); setNotice("კოდი ხელახლა გაიგზავნა.");}
        catch(err) {setError((err as {userMessage?: string}).userMessage || "ვერ გაიგზავნა.");}
        finally {setPending(false);}
      }}>ხელახლა გაგზავნეთ კოდი</button>
    </>}
    {notice ? <p className="auth-hint" role="status">{notice}</p> : null}
    <div className="auth-submit">
      <FormAlert error={error || null} />
      <Button variant="primary" className="ma-btn--block" type="submit" disabled={pending}>{pending ? "იტვირთება…" : sent ? "დაადასტურეთ" : "მიიღეთ კოდი"}</Button>
    </div>
    {!verification ? <button type="button" className="auth-link" onClick={onDone}>დაბრუნდით შესვლაზე</button> : null}
  </form>;
}
