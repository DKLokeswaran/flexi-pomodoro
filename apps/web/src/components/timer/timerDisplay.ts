/** Shared Tailwind classes for the idle and active timer displays. */
export const timerDisplay = {
  phaseLabel: "type-label inline-flex items-center gap-2",
  clock:
    "type-numeral py-2 text-[clamp(4.5rem,20vw,7.375rem)] whitespace-nowrap",
  cycle: "text-fg-soft",
  estimatedEnd:
    "mt-1.5 flex flex-col gap-0.5 leading-snug text-muted-foreground [&_strong]:font-mono [&_strong]:text-sm [&_strong]:tabular-nums",
  decisionHint:
    "max-w-[22rem] font-serif text-xl leading-snug text-primary italic",
  actions: "mt-2 flex flex-wrap justify-center gap-3",
  liveStats:
    "type-label mt-6 flex flex-wrap justify-center gap-x-10 gap-y-5 text-muted-foreground [&_strong]:type-numeral [&_strong]:mt-2 [&_strong]:block [&_strong]:text-[1.75rem] [&_strong]:tracking-[-0.03em] [&_strong]:normal-case",
} as const;
