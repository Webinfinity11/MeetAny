"use client";
import { Button } from "../ui/Button";



export function ServiceUnavailable() {
  return (
    <div className="ma-empty">
      <h2 className="ma-empty__title" role="alert">სერვისი დროებით მიუწვდომელია</h2>
      <p className="ma-empty__text">მონაცემები ვერ ჩაიტვირთა. სცადე ხელახლა.</p>
      <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
        ხელახლა ცდა
      </Button>
    </div>
  );
}
