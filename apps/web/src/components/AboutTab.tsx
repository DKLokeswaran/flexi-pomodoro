import { Copy } from "lucide-react";
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
import styles from "./AboutTab.module.css";

function StatusPill({ status }: { status: FeatureStatus }) {
  const label = status === "available" ? "Available" : "Coming soon";
  return (
    <span
      className={`${styles.status} ${
        status === "available" ? styles.statusAvailable : styles.statusSoon
      }`}
    >
      {label}
    </span>
  );
}

function CreditRow({ item }: { item: CreditItem }) {
  return (
    <p className={styles.creditLine}>
      <span className={styles.creditLabel}>{item.label}</span>
      {item.value}
    </p>
  );
}

type HealthUi = { state: "unknown" | "ok" | "error"; label: string };

function healthUi(isPending: boolean, isError: boolean): HealthUi {
  if (isPending) return { state: "unknown", label: "Checking…" };
  if (isError) return { state: "error", label: "Unreachable" };
  return { state: "ok", label: "OK" };
}

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

export function AboutTab() {
  const year = new Date().getFullYear();
  const healthQuery = useHealthQuery();
  const { pushToast } = useToast();

  const availableCount = FEATURES.filter((f) => f.status === "available").length;
  const soonCount = FEATURES.filter((f) => f.status === "soon").length;
  const health = healthUi(healthQuery.isPending, healthQuery.isError);

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(buildDiagnostics(health.label));
      pushToast({ kind: "success", message: "Diagnostics copied" });
    } catch {
      pushToast({ kind: "error", message: "Could not copy to clipboard" });
    }
  }

  return (
    <section className={`panel ${styles.page}`} aria-labelledby="about-heading">
      <header className={styles.section}>
        <h2 id="about-heading">About</h2>
        <p className="lead">{TAGLINE}</p>
        <p className={styles.metaLine}>
          Version <strong>{__APP_VERSION__}</strong>
        </p>
        <p className={styles.copyright}>© {year} Flexi Pomodoro</p>
      </header>

      <section className={styles.section} aria-labelledby="about-notes-heading">
        <h3 id="about-notes-heading">Important notes</h3>
        <ul className={styles.notes}>
          {IMPORTANT_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="about-release-heading">
        <h3 id="about-release-heading">Release</h3>
        <p className={styles.release}>{RELEASE_STATUS}</p>
      </section>

      <section className={styles.section} aria-labelledby="about-features-heading">
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
        <p className={`${styles.footnote} stub`}>
          Basic debug toggles are in Settings. More debug features are planned.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="about-links-live-heading">
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

      <section
        className={styles.section}
        aria-labelledby="about-instance-heading"
      >
        <div className={styles.instanceHeader}>
          <h3 id="about-instance-heading">Instance</h3>
          <button
            type="button"
            className={`btn ${styles.copyBtn}`}
            onClick={() => void copyDiagnostics()}
          >
            <Copy size={16} aria-hidden />
            Copy diagnostics
          </button>
        </div>
        <dl className={styles.instance}>
          <div className={styles.instanceRow}>
            <dt>App version</dt>
            <dd>{__APP_VERSION__}</dd>
          </div>
          <div className={styles.instanceRow}>
            <dt>API health</dt>
            <dd
              className={
                health.state === "ok"
                  ? styles.healthOk
                  : health.state === "error"
                    ? styles.healthError
                    : styles.healthUnknown
              }
            >
              {health.label}
            </dd>
          </div>
          {INSTANCE_COMING_SOON.map(({ label, value }) => (
            <div key={label} className={styles.instanceRow}>
              <dt>{label}</dt>
              <dd className={styles.instanceSoon}>{value}</dd>
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

      <section className={styles.section} aria-labelledby="about-credits-heading">
        <h3 id="about-credits-heading">Credits</h3>
        <div className={styles.credits}>
          {CREDITS.map((item, i) => (
            <CreditRow key={`${item.kind}-${i}`} item={item} />
          ))}
          <p className={styles.creditLine}>
            <span className={styles.creditLabel}>Fonts</span>
            {FONT_CREDITS.map((font, i) => (
              <span key={font.name}>
                {i > 0 ? ", " : null}
                <a href={font.href} target="_blank" rel="noopener noreferrer">
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
