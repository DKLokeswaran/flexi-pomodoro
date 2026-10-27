import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CREDITS,
  FEATURES,
  FONT_CREDITS,
  IMPORTANT_NOTES,
  INSTANCE_COMING_SOON,
  LEGAL_NOTES,
  LINKS_COMING_SOON,
  LINKS_LIVE,
  RELEASE_STATUS,
  TAGLINE,
  type CreditItem,
  type FeatureStatus,
} from "../constants/about";
import { useHealthQuery } from "../queries/useHealthQuery";
import { useToast } from "../providers/ToastProvider";
import { AboutAccordion } from "./about/AboutAccordion";
import { LinkCard } from "./about/LinkCard";

/** Shared Tailwind classes for About-tab sections. */
const styles = {
  section:
    "flex flex-col border-t border-border pt-5 [&_h3]:type-label [&_h3]:mb-3 [&_h3]:text-muted-foreground",
  meta: "text-muted-foreground",
  notes:
    "flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-fg-soft marker:text-border-strong",
  featureList:
    "grid list-none grid-cols-1 gap-x-4 gap-y-3 min-[561px]:grid-cols-2",
  featureRow: "flex flex-col gap-1.5 text-sm text-foreground",
  linkCardGrid:
    "grid grid-cols-1 gap-3.5 min-[520px]:grid-cols-2 min-[720px]:grid-cols-3",
  instanceRow: "grid grid-cols-[9rem_1fr] gap-3 text-sm",
  instanceTerm: "text-muted-foreground",
  instanceValue: "font-mono text-[13px] text-foreground",
  creditLine: "text-sm leading-normal text-muted-foreground",
  creditLabel: "mr-1.5 font-normal text-fg-bright",
} as const;

/** Available vs coming-soon badge for the features list. */
function StatusPill({ status }: { status: FeatureStatus }) {
  const label = status === "available" ? "Available" : "Coming soon";
  return (
    <Badge variant={status === "available" ? "default" : "outline"}>
      {label}
    </Badge>
  );
}

/** One credit line: label plus plain-text value. */
function CreditRow({ item }: { item: CreditItem }) {
  return (
    <p className={styles.creditLine}>
      <span className={styles.creditLabel}>{item.label}</span>
      {item.value}
    </p>
  );
}

type HealthUi = { state: "unknown" | "ok" | "error"; label: string };

/** Map query status to a short health label for the instance section. */
function healthUi(isPending: boolean, isError: boolean): HealthUi {
  if (isPending) return { state: "unknown", label: "Checking…" };
  if (isError) return { state: "error", label: "Unreachable" };
  return { state: "ok", label: "OK" };
}

/** Text color for the API health value (ok / error / still checking). */
function healthClassName(state: HealthUi["state"]): string {
  if (state === "ok") return "text-primary";
  if (state === "error") return "text-destructive";
  return "text-muted-foreground";
}

/** Plain-text diagnostics blob for the copy button. */
function buildDiagnostics(healthText: string): string {
  return [
    "Flexi Pomodoro diagnostics",
    `App version: ${__APP_VERSION__}`,
    `API health: ${healthText}`,
    `URL: ${window.location.origin}`,
    `Browser: ${navigator.userAgent}`,
    "Server timezone: (not available)",
    "Build commit / date: (not available)",
  ].join("\n");
}

/** About page: notes, features, links, instance health, legal, credits. */
export function AboutTab() {
  const year = new Date().getFullYear();
  const healthQuery = useHealthQuery();
  const { pushToast } = useToast();

  const availableCount = FEATURES.filter(
    (feature) => feature.status === "available",
  ).length;
  const soonCount = FEATURES.filter(
    (feature) => feature.status === "soon",
  ).length;
  const health = healthUi(healthQuery.isPending, healthQuery.isError);

  /** Copy instance diagnostics to the clipboard, with success/error toasts. */
  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(buildDiagnostics(health.label));
      pushToast({ kind: "success", message: "Diagnostics copied" });
    } catch {
      pushToast({ kind: "error", message: "Could not copy to clipboard" });
    }
  }

  return (
    <section
      className="flex max-w-[52rem] animate-rise flex-col gap-8"
      aria-labelledby="about-heading"
    >
      <header className="flex flex-col gap-3">
        <h2 id="about-heading" className="type-display text-[2rem]">
          About
        </h2>
        <p className="text-fg-soft">{TAGLINE}</p>
        <p className={styles.meta}>
          Version{" "}
          <strong className="font-mono text-sm">{__APP_VERSION__}</strong>
        </p>
        <p className="type-label text-muted-foreground">
          © {year} Flexi Pomodoro
        </p>
      </header>

      {/* Product caveats shown above the feature list. */}
      <section className={styles.section} aria-labelledby="about-notes-heading">
        <h3 id="about-notes-heading">Important notes</h3>
        <ul className={styles.notes}>
          {IMPORTANT_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section
        className={styles.section}
        aria-labelledby="about-release-heading"
      >
        <h3 id="about-release-heading">Release</h3>
        <p className={styles.meta}>{RELEASE_STATUS}</p>
      </section>

      {/* Expandable feature inventory with available / coming-soon counts. */}
      <section
        className={styles.section}
        aria-labelledby="about-features-heading"
      >
        <h3 id="about-features-heading">Features</h3>
        <AboutAccordion
          title={`Features & status (${FEATURES.length} items)`}
          summary={`${availableCount} available · ${soonCount} coming soon`}
        >
          <ul className={styles.featureList}>
            {FEATURES.map(({ label, status }) => (
              <li key={label} className={styles.featureRow}>
                <span>{label}</span>
                <StatusPill status={status} />
              </li>
            ))}
          </ul>
        </AboutAccordion>
        <p className={cn(styles.meta, "mt-3")}>
          Basic debug toggles are in Settings. More debug features are planned.
        </p>
      </section>

      <section
        className={styles.section}
        aria-labelledby="about-links-live-heading"
      >
        <h3 id="about-links-live-heading">Links</h3>
        <div className={styles.linkCardGrid}>
          {LINKS_LIVE.map((card) => (
            <LinkCard key={card.id} {...card} />
          ))}
        </div>
      </section>

      <section
        className={styles.section}
        aria-labelledby="about-links-soon-heading"
      >
        <h3 id="about-links-soon-heading">More links</h3>
        <AboutAccordion
          title={`Coming soon (${LINKS_COMING_SOON.length} links)`}
        >
          <div className={styles.linkCardGrid}>
            {LINKS_COMING_SOON.map((card) => (
              <LinkCard
                key={card.id}
                label={card.label}
                icon={card.icon}
                cta="Coming soon"
                soon
              />
            ))}
          </div>
        </AboutAccordion>
      </section>

      {/* Instance identity plus a one-click diagnostics dump. */}
      <section
        className={styles.section}
        aria-labelledby="about-instance-heading"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 [&_h3]:mb-0">
          <h3 id="about-instance-heading">Instance</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyDiagnostics()}
          >
            <Copy data-icon="inline-start" aria-hidden />
            Copy diagnostics
          </Button>
        </div>
        <dl className="flex flex-col gap-2">
          <div className={styles.instanceRow}>
            <dt className={styles.instanceTerm}>App version</dt>
            <dd className={styles.instanceValue}>{__APP_VERSION__}</dd>
          </div>
          <div className={styles.instanceRow}>
            <dt className={styles.instanceTerm}>API health</dt>
            <dd
              className={cn(
                styles.instanceValue,
                healthClassName(health.state),
              )}
            >
              {health.label}
            </dd>
          </div>
          {INSTANCE_COMING_SOON.map(({ label, value }) => (
            <div key={label} className={styles.instanceRow}>
              <dt className={styles.instanceTerm}>{label}</dt>
              <dd className={cn(styles.instanceValue, "text-muted-foreground")}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="about-legal-heading">
        <h3 id="about-legal-heading">Legal &amp; trust</h3>
        <ul className={styles.notes}>
          {LEGAL_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section
        className={styles.section}
        aria-labelledby="about-credits-heading"
      >
        <h3 id="about-credits-heading">Credits</h3>
        <div className="flex flex-col gap-1.5">
          {CREDITS.map((item, index) => (
            <CreditRow key={`${item.kind}-${index}`} item={item} />
          ))}
          <p className={styles.creditLine}>
            <span className={styles.creditLabel}>Fonts</span>
            {FONT_CREDITS.map((font, index) => (
              <span key={font.name}>
                {index > 0 ? ", " : null}
                <a
                  href={font.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {font.name}
                </a>
              </span>
            ))}
          </p>
        </div>
      </section>
    </section>
  );
}
