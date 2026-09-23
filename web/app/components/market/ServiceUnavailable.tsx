"use client";

import { Icon } from "../Icon";

export function ServiceUnavailable() {
  return (
    <div className="ma-empty">
      <span className="ma-empty__icon"><Icon name="refresh-cw" /></span>
      <h2 className="ma-empty__title" role="alert">სერვისი დროებით მიუწვდომელია</h2>
      <p className="ma-empty__text">მონაცემები ვერ ჩაიტვირთა. სცადე ხელახლა.</p>
      <button type="button" className="ma-btn ma-btn--secondary" onClick={() => window.location.reload()}>
        ხელახლა ცდა
      </button>
    </div>
  );
}
