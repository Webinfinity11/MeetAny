"use client";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Structure";



export function ServiceUnavailable() {
  return (
    <EmptyState role="alert" icon="circle-alert" title="სერვისი დროებით მიუწვდომელია" text="მონაცემები ვერ ჩაიტვირთა. სცადე ხელახლა." action={<Button type="button" variant="secondary" onClick={() => window.location.reload()}>
        ხელახლა ცდა
      </Button>} />
  );
}
