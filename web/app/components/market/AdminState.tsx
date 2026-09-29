import styles from "./admin.module.css";

export function AdminState({ title, text, error = false, onRetry, onClear, onFirst }: {
  title: string; text?: string; error?: boolean; onRetry?: () => void; onClear?: () => void; onFirst?: () => void;
}) {
  return <div className={`ma-empty ${styles.state}`} role={error ? "alert" : "status"}>
    <h2 className="ma-empty__title">{title}</h2>
    {text ? <p className="ma-empty__text">{text}</p> : null}
    {onRetry || onClear || onFirst ? <div className="ma-empty__actions">
      {onRetry ? <button type="button" className="ma-btn ma-btn--secondary" onClick={onRetry}>ხელახლა ცდა</button> : null}
      {onClear ? <button type="button" className="ma-btn ma-btn--secondary" onClick={onClear}>ფილტრების გასუფთავება</button> : null}
      {onFirst ? <button type="button" className="ma-btn ma-btn--secondary" onClick={onFirst}>პირველი გვერდი</button> : null}
    </div> : null}
  </div>;
}
