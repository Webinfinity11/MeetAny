"use client";

import { useState } from "react";

// Georgian field validation for forms with noValidate: one message under each field,
// aria-invalid + aria-describedby on the control, focus on the first invalid field.
export type FieldErrors = Record<string, string>;

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Shows the errors; focuses the first one in `order` (control ids). Returns true when valid. */
  function check(next: FieldErrors, order: string[]) {
    setErrors(next);
    const first = order.find((id) => next[id]);
    if (first) document.getElementById(first)?.focus();
    return !first;
  }
  function clear(id: string) {
    setErrors((prev) => (prev[id] ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)) : prev));
  }
  /** Props for the control with this id. */
  function control(id: string, describedBy?: string) {
    const describe = [errors[id] ? `${id}-error` : "", describedBy || ""].filter(Boolean).join(" ");
    return { id, "aria-invalid": errors[id] ? true : undefined, "aria-describedby": describe || undefined };
  }
  function message(id: string) {
    return errors[id] ? <p className="ma-field__error" id={`${id}-error`}>{errors[id]}</p> : null;
  }
  return { errors, check, clear, control, message };
}
