import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import styles from "./AboutAccordion.module.css";

type AboutAccordionProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function AboutAccordion({
  title,
  summary,
  defaultOpen = false,
  children,
}: AboutAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={`${styles.accordion}${open ? ` ${styles.accordionOpen}` : ""}`}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={styles.chevron} aria-hidden />
        <span className={styles.title}>{title}</span>
        {summary ? (
          <span className={styles.summary}>{summary}</span>
        ) : null}
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
