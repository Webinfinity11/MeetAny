export function Icon({ name, className }: { name: string; className?: string }) {
  const cls = className ? "icon " + className : "icon";
  return (
    <svg className={cls} viewBox="0 0 24 24" data-icon={name} aria-hidden="true" focusable="false">
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
