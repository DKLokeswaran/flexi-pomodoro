import type { LinkIcon } from "../../constants/about";
import { AboutIcon } from "./AboutIcon";
import styles from "./LinkCard.module.css";

type LinkCardProps = {
  label: string;
  description?: string;
  cta: string;
  href?: string;
  external?: boolean;
  icon: LinkIcon;
  soon?: boolean;
};

export function LinkCard({
  label,
  description,
  cta,
  href,
  external,
  icon,
  soon = false,
}: LinkCardProps) {
  return (
    <article className={`${styles.card}${soon ? ` ${styles.cardSoon}` : ""}`}>
      <div className={styles.icon} aria-hidden>
        <AboutIcon icon={icon} />
      </div>
      <h4 className={styles.title}>{label}</h4>
      {description ? (
        <p className={styles.desc}>{description}</p>
      ) : (
        <div className={styles.descSpacer} aria-hidden />
      )}
      {soon || !href ? (
        <span className={`${styles.cta} ${styles.ctaDisabled}`}>{cta}</span>
      ) : (
        <a
          href={href}
          className={styles.cta}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {cta}
        </a>
      )}
    </article>
  );
}
