import { cn } from "@/lib/utils";

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
    <nav
      className="flex flex-wrap gap-6 border-b border-border"
      aria-label="Primary"
    >
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onChange(id)}
          className={cn(
            "type-label -mb-px cursor-pointer border-b border-transparent py-3 text-muted-foreground transition-colors duration-[340ms] ease-quiet hover:text-foreground",
            tab === id && "border-primary text-fg-bright",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export type { Tab };
