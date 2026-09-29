"use client";
import { CustomSelect } from "./CustomSelect";
import { createContext, useContext, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
const FieldContext = createContext<{ id: string; describedBy?: string; invalid: boolean; required?: boolean } | null>(null);
export type FieldProps = { id?: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string };
/** Connects one control with its label, hint and validation error through stable ARIA ids. */
export function Field({ id, label, hint, error, required, children, className = "" }: FieldProps) {
  const generated = useId();
  const controlId = id || generated;
  const describedBy = [hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null].filter(Boolean).join(" ") || undefined;
  return <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}><div className={`ma-field${error ? " ma-field--error" : ""} ${className}`.trim()}><label className="ma-field__label" htmlFor={controlId}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && <p id={`${controlId}-hint`} className="ma-field__help">{hint}</p>}{error && <p id={`${controlId}-error`} className="ma-field__error">{error}</p>}</div></FieldContext.Provider>;
}
function useControl(props: { id?: string; required?: boolean; "aria-invalid"?: InputHTMLAttributes<HTMLInputElement>["aria-invalid"]; "aria-describedby"?: string }) {
  const context = useContext(FieldContext);
  return { id: context?.id || props.id, required: props.required ?? context?.required, "aria-invalid": context?.invalid || props["aria-invalid"], "aria-describedby": [context?.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined };
}
/** Native input; inherits Field's required, invalid and description state. */
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { const aria = useControl(props); return <input {...props} {...aria} className={`ma-input ${className}`.trim()} />; }
/** Custom select; inherits Field's required, invalid and description state. */
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) { const aria = useControl(props); return <CustomSelect {...props} {...aria} className={`ma-select ${className}`.trim()} />; }
/** Native multiline control; inherits Field's required, invalid and description state. */
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { const aria = useControl(props); return <textarea {...props} {...aria} className={`ma-textarea ${className}`.trim()} />; }
