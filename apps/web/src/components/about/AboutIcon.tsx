import {
  Accessibility,
  BookOpen,
  Bug,
  FileCode,
  GitPullRequest,
  Globe,
  Keyboard,
  Lock,
  Mail,
  Map,
  Scale,
  ScrollText,
  Shield,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { siGithub } from "simple-icons";
import type { BrandSlug, LinkIcon, UiIconName } from "../../constants/about";

const UI_ICONS: Record<UiIconName, LucideIcon> = {
  tag: Tag,
  bug: Bug,
  globe: Globe,
  book: BookOpen,
  scroll: ScrollText,
  map: Map,
  users: Users,
  "git-pull-request": GitPullRequest,
  shield: Shield,
  lock: Lock,
  scale: Scale,
  "file-code": FileCode,
  mail: Mail,
  keyboard: Keyboard,
  accessibility: Accessibility,
};

const BRAND_SVGS: Record<BrandSlug, { path: string; title: string }> = {
  github: { path: siGithub.path, title: siGithub.title },
};

type AboutIconProps = {
  icon: LinkIcon;
  className?: string;
};

/** Brand SVG or Lucide icon for About link cards. */
export function AboutIcon({ icon, className }: AboutIconProps) {
  if (icon.kind === "brand") {
    const brand = BRAND_SVGS[icon.slug];
    return (
      <svg
        className={className}
        role="img"
        viewBox="0 0 24 24"
        aria-label={brand.title}
      >
        <path d={brand.path} fill="currentColor" />
      </svg>
    );
  }

  const Lucide = UI_ICONS[icon.name];
  return <Lucide className={className} aria-hidden />;
}
