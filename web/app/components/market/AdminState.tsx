
import { Button } from "../ui/Button";
import styles from "./admin.module.css";

export function AdminState({ title, text, error = false, onRetry, onClear, onFirst }: {
  title: string; text?: string; error?: boolean; onRetry?: () => void; onClear?: () => void; onFirst?: () => void;
}) {
  return <div className={`ma-empty ${styles.state}`} role={error ? "alert" : "status"}>
    <h2 className="ma-empty__title">{title}</h2>
    {text ? <p className="ma-empty__text">{text}</p> : null}
    {onRetry || onClear || onFirst ? <div className="ma-empty__actions">
      {onRetry ? <Button type="button" variant="secondary" onClick={onRetry}>ხელახლა ცდა</Button> : null}
      {onClear ? <Button type="button" variant="secondary" onClick={onClear}>ფილტრების გასუფთავება</Button> : null}
      {onFirst ? <Button type="button" variant="secondary" onClick={onFirst}>პირველი გვერდი</Button> : null}
    </div> : null}
  </div>;
}
