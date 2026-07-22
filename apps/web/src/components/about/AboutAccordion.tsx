import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

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
    <div className={`about-accordion${open ? " about-accordion--open" : ""}`}>
      <button
        type="button"
        className="about-accordion-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className="about-accordion-chevron" aria-hidden />
        <span className="about-accordion-title">{title}</span>
        {summary ? (
          <span className="about-accordion-summary">{summary}</span>
        ) : null}
      </button>
      {open ? (
        <div id={panelId} className="about-accordion-panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}
