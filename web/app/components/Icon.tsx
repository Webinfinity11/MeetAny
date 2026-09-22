export function Icon({ name, className }: { name: string; className?: string }) {
  const cls = className ? "icon " + className : "icon";
  return (
    <svg className={cls} aria-hidden="true">
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
