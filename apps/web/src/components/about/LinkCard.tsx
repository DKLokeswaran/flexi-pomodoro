import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

/** About-tab link card: live CTA or a disabled "coming soon" row. */
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
    <Card className={cn("min-h-[10.5rem]", soon && "opacity-80")}>
      <CardContent className="flex flex-1 flex-col items-start">
        <div className="mb-3 size-7 text-primary [&_svg]:size-full" aria-hidden>
          <AboutIcon icon={icon} />
        </div>
        <h4 className="type-label mb-1.5 text-fg-bright">{label}</h4>
        {description ? (
          <p className="mb-3.5 flex-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : (
          <div className="flex-1" aria-hidden />
        )}
        {soon || !href ? (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none mt-auto text-muted-foreground",
            )}
          >
            {cta}
          </span>
        ) : (
          <a
            href={href}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-auto",
            )}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {cta}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
