type Tab = "timer" | "defaults" | "analytics" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "timer", label: "Timer" },
  { id: "defaults", label: "Defaults" },
  { id: "analytics", label: "Analytics" },
  { id: "about", label: "About" },
];

export function Nav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className="nav" aria-label="Primary">
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
