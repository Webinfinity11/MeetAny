export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`icon${className ? " " + className : ""}`} aria-hidden="true">
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
