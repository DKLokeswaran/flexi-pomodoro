export const GITHUB_REPO = "https://github.com/DKLokeswaran/flexi-pomodoro";

export const TAGLINE =
  "Self-hosted, flow-aware Pomodoro — decision window, extended work, soft pause.";

export const RELEASE_STATUS =
  "Alpha — timer core is live; persistence, analytics, and polish are in progress.";

export type FeatureStatus = "available" | "soon";

export type AboutFeature = {
  label: string;
  status: FeatureStatus;
};

export const IMPORTANT_NOTES = [
  "Alpha build — things may break; not for production-critical daily use.",
  "Browsers: latest Chrome, Firefox, and Safari.",
] as const;

/** Alpha/beta only — remove before stable v1. */
export const FEATURES: AboutFeature[] = [
  { label: "Timer, decision window, extended work", status: "available" },
  { label: "Soft pause", status: "available" },
  { label: "Defaults & per-session overrides", status: "available" },
  { label: "Real-time session updates (SSE)", status: "available" },
  { label: "Docker self-host image", status: "available" },
  { label: "API health check", status: "available" },
  { label: "Hard pause (experimental)", status: "available" },
  { label: "SQLite persistence & crash recovery", status: "soon" },
  { label: "Analytics dashboard", status: "soon" },
  { label: "Curated alert sounds & mute", status: "soon" },
  { label: "Browser notifications", status: "soon" },
  { label: "Tags, CSV import/export, backup", status: "soon" },
  { label: "More debug features", status: "soon" },
  { label: "Check for updates", status: "soon" },
  { label: "Multi-user auth, mobile apps, integrations", status: "soon" },
];

export type BrandSlug = "github";

export type UiIconName =
  | "tag"
  | "bug"
  | "globe"
  | "book"
  | "scroll"
  | "map"
  | "users"
  | "git-pull-request"
  | "shield"
  | "lock"
  | "scale"
  | "file-code"
  | "mail"
  | "keyboard"
  | "accessibility";

export type LinkIcon =
  { kind: "brand"; slug: BrandSlug } | { kind: "ui"; name: UiIconName };

export type LiveLinkCard = {
  id: string;
  label: string;
  description: string;
  cta: string;
  href: string;
  external?: boolean;
  icon: LinkIcon;
};

export const LINKS_LIVE: LiveLinkCard[] = [
  {
    id: "source",
    label: "Source code",
    description: "Browse source and contribute on GitHub.",
    cta: "View on GitHub",
    href: GITHUB_REPO,
    external: true,
    icon: { kind: "brand", slug: "github" },
  },
  {
    id: "releases",
    label: "Releases",
    description: "Version history and release notes.",
    cta: "See releases",
    href: `${GITHUB_REPO}/releases`,
    external: true,
    icon: { kind: "ui", name: "tag" },
  },
  {
    id: "issues",
    label: "Report an issue",
    description: "Bug reports and feedback.",
    cta: "Open issue",
    href: `${GITHUB_REPO}/issues/new`,
    external: true,
    icon: { kind: "ui", name: "bug" },
  },
];

export type SoonLinkCard = {
  id: string;
  label: string;
  icon: LinkIcon;
};

export const LINKS_COMING_SOON: SoonLinkCard[] = [
  {
    id: "website",
    label: "Product website",
    icon: { kind: "ui", name: "globe" },
  },
  { id: "docs", label: "Documentation", icon: { kind: "ui", name: "book" } },
  { id: "changelog", label: "Changelog", icon: { kind: "ui", name: "scroll" } },
  { id: "roadmap", label: "Public roadmap", icon: { kind: "ui", name: "map" } },
  { id: "community", label: "Community", icon: { kind: "ui", name: "users" } },
  {
    id: "contributing",
    label: "Contributing",
    icon: { kind: "ui", name: "git-pull-request" },
  },
  {
    id: "security",
    label: "Security policy",
    icon: { kind: "ui", name: "shield" },
  },
  {
    id: "privacy",
    label: "Privacy policy",
    icon: { kind: "ui", name: "lock" },
  },
  { id: "terms", label: "Terms of use", icon: { kind: "ui", name: "scale" } },
  {
    id: "oss-licenses",
    label: "Open-source licenses",
    icon: { kind: "ui", name: "file-code" },
  },
  {
    id: "support",
    label: "Support / contact",
    icon: { kind: "ui", name: "mail" },
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    icon: { kind: "ui", name: "keyboard" },
  },
  {
    id: "a11y",
    label: "Accessibility statement",
    icon: { kind: "ui", name: "accessibility" },
  },
];

export const LEGAL_NOTES = [
  "Self-hosted single-user app — session data stays on your instance.",
  "Persistence across restarts — coming soon.",
  "Privacy policy and terms of use — coming soon.",
] as const;

export type CreditItem =
  | { kind: "text"; label: string; value: string }
  | { kind: "soon"; label: string; value: string };

export const FONT_CREDITS = [
  {
    name: "Fraunces",
    href: "https://fonts.google.com/specimen/Fraunces",
  },
  {
    name: "Source Sans 3",
    href: "https://fonts.google.com/specimen/Source+Sans+3",
  },
] as const;

export const CREDITS: CreditItem[] = [
  {
    kind: "text",
    label: "Maintainer",
    value: "DKLokeswaran",
  },
  {
    kind: "soon",
    label: "Alert sounds",
    value: "Placeholder tones today; curated open-license pack coming soon.",
  },
  {
    kind: "soon",
    label: "Open-source license",
    value: "Coming soon",
  },
];

export const INSTANCE_COMING_SOON = [
  { label: "Server timezone", value: "Coming soon" },
  { label: "Build commit / date", value: "Coming soon" },
] as const;
