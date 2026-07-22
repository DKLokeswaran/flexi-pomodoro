import type { LinkIcon } from "../../constants/about";
import { AboutIcon } from "./AboutIcon";

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
    <article
      className={`about-link-card${soon ? " about-link-card--soon" : ""}`}
    >
      <div className="about-link-card-icon" aria-hidden>
        <AboutIcon icon={icon} />
      </div>
      <h4 className="about-link-card-title">{label}</h4>
      {description ? (
        <p className="about-link-card-desc">{description}</p>
      ) : (
        <div className="about-link-card-desc-spacer" aria-hidden />
      )}
      {soon || !href ? (
        <span className="about-link-card-cta about-link-card-cta--disabled">
          {cta}
        </span>
      ) : (
        <a
          href={href}
          className="about-link-card-cta"
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
