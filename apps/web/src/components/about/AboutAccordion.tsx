import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AboutAccordionProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Collapsible section used on the About tab for long lists. */
export function AboutAccordion({
  title,
  summary,
  defaultOpen = false,
  children,
}: AboutAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-y border-border"
    >
      <CollapsibleTrigger className="group/trigger flex w-full cursor-pointer items-center gap-3 py-3 text-left text-foreground transition-colors duration-[340ms] ease-quiet hover:text-fg-bright">
        <Plus
          className="size-4 shrink-0 text-primary transition-transform duration-[340ms] ease-quiet group-data-[panel-open]/trigger:rotate-45"
          aria-hidden
        />
        <span className="text-[15px]">{title}</span>
        {summary ? (
          <span className="type-label ml-auto text-right text-muted-foreground">
            {summary}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border py-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
