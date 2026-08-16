import styles from "./Nav.module.css";

type Tab = "timer" | "settings" | "analytics" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "timer", label: "Timer" },
  { id: "settings", label: "Settings" },
  { id: "analytics", label: "Analytics" },
  { id: "about", label: "About" },
];

/** Primary tab bar for Timer, Settings, Analytics, and About. */
export function Nav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export type { Tab };
