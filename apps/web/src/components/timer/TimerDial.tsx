import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CycleDotState, DialProgress } from "../../utils/dialProgress";

export type DialReadout = {
  label: string;
  value: string;
};

const SIZE = 520;
const CENTER = SIZE / 2;
const OUTER_RING_R = 252;
const ARC_R = 240;
const TICK_OUTER_R = 230;
const TICK_MINOR_R = 222;
const TICK_MAJOR_R = 214;
const QUARTER_LABEL_R = 198;
const OVERTIME_R = 182;
const TICK_COUNT = 60;
const MAJOR_EVERY = 5;
const QUARTER_LABELS = ["00", "15", "30", "45"];
const COMET_RING_WIDTH = 2;
const COMET_EDGE_FEATHER = 0.75;
const COMET_HEAD_R = 3;
const COMET_TAIL_DEG = 110;

/** Dial view-box units as a percentage of the dial's width. */
function dialPercent(units: number): string {
  return `${(units / SIZE) * 100}%`;
}

/** Point on a circle around the dial center; 0 is 12 o'clock, clockwise. */
function polar(radius: number, fraction: number): { x: number; y: number } {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

/** Minute ticks; ticks inside the remaining arc turn gold. */
function DialTicks({ remaining }: { remaining: number }) {
  return Array.from({ length: TICK_COUNT }, (_, index) => {
    const fraction = index / TICK_COUNT;
    const isMajor = index % MAJOR_EVERY === 0;
    const start = polar(isMajor ? TICK_MAJOR_R : TICK_MINOR_R, fraction);
    const end = polar(TICK_OUTER_R, fraction);
    return (
      <line
        key={index}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className={cn(
          fraction < remaining ? "stroke-primary" : "stroke-border-strong",
          isMajor ? "stroke-[1.5]" : "stroke-1",
        )}
      />
    );
  });
}

/** Mono 00/15/30/45 indices inside the tick ring. */
function QuarterLabels() {
  return QUARTER_LABELS.map((label, index) => {
    const point = polar(QUARTER_LABEL_R, index / QUARTER_LABELS.length);
    return (
      <text
        key={label}
        x={point.x}
        y={point.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground font-mono text-[11px] tracking-[0.16em]"
      >
        {label}
      </text>
    );
  });
}

/** Gold dot with a soft halo at the tip of the remaining arc. */
function ArcTip({ remaining }: { remaining: number }) {
  const tip = polar(ARC_R, remaining);
  return (
    <g className="animate-dial-tip">
      <circle cx={tip.x} cy={tip.y} r={12} className="fill-primary/15" />
      <circle cx={tip.x} cy={tip.y} r={4} className="fill-primary" />
    </g>
  );
}

/** Hairline dial face: outer ring, ticks, remaining arc, overtime track. */
function DialFace({ progress }: { progress: DialProgress }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className="absolute inset-0 size-full"
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={OUTER_RING_R}
        className="fill-[color-mix(in_srgb,var(--card)_70%,var(--background))] stroke-border-strong stroke-1"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={ARC_R}
        className="fill-none stroke-border stroke-[2.5]"
      />
      <DialTicks remaining={progress.remaining} />
      <QuarterLabels />
      {/* Remaining arc, clockwise from 12 o'clock */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={ARC_R}
        pathLength={1}
        strokeDasharray={`${progress.remaining} 1`}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        className="animate-dial-draw fill-none stroke-primary stroke-[2.5] transition-[stroke-dasharray] duration-300 ease-linear [stroke-linecap:round]"
      />
      <ArcTip remaining={progress.remaining} />
      {progress.overtimeLaps !== null ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OVERTIME_R}
          className="fill-none stroke-border stroke-[1.5]"
        />
      ) : null}
    </svg>
  );
}

/** Ring-shaped mask (as a radial gradient) for a band at the box edge. */
function ringMask(outerR: number): string {
  const innerEdge = 100 - (COMET_RING_WIDTH / outerR) * 100;
  const feather = (COMET_EDGE_FEATHER / outerR) * 100;
  return `radial-gradient(closest-side, transparent ${innerEdge - feather}%, #000 ${innerEdge}%, #000 ${100 - feather}%, transparent 100%)`;
}

/**
 * Overtime comet: a gold head circling once per lap with a tail fading to nothing.
 * The angle never wraps, so motion always runs forward; the tail grows only during the first lap.
 */
function OvertimeComet({ laps }: { laps: number }) {
  const headDeg = laps * 360;
  const tailDeg = Math.min(COMET_TAIL_DEG, headDeg);
  const outerR = OVERTIME_R + COMET_RING_WIDTH / 2;
  const mask = ringMask(outerR);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute will-change-transform motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-linear"
      style={{
        width: dialPercent(outerR * 2),
        height: dialPercent(outerR * 2),
        left: dialPercent(CENTER - outerR),
        top: dialPercent(CENTER - outerR),
        transform: `rotate(${headDeg}deg)`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(transparent 0deg ${360 - tailDeg}deg, var(--primary) 360deg)`,
          mask,
          WebkitMask: mask,
        }}
      />
      <span
        className="absolute left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        style={{
          top: `${(COMET_RING_WIDTH / 2 / (outerR * 2)) * 100}%`,
          width: `${((COMET_HEAD_R * 2) / (outerR * 2)) * 100}%`,
        }}
      />
    </div>
  );
}

/** One dot per cycle: done filled, current blinking, pending hollow. */
function CycleDots({ states }: { states: CycleDotState[] }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {states.map((state, index) => (
        <span
          key={index}
          className={cn(
            "size-1.5 rounded-full border",
            state === "pending" && "border-border-strong",
            state === "done" && "border-primary bg-primary",
            state === "current" && "animate-breathe border-primary bg-primary",
          )}
        />
      ))}
    </div>
  );
}

/** Three mono readouts on hairlines below the dial. */
function DialReadouts({ readouts }: { readouts: DialReadout[] }) {
  return (
    <dl className="grid w-full max-w-[520px] grid-cols-3 divide-x divide-border border-y border-border">
      {readouts.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1.5 px-2 py-3">
          <dt className="type-label text-muted-foreground">{label}</dt>
          <dd className="font-mono text-sm text-fg-bright tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Timer dial: hairline face with the countdown, cycle dots and readouts. */
export function TimerDial({
  progress,
  eyebrow,
  clock,
  clockSuffix,
  cycleDots,
  readouts,
}: {
  progress: DialProgress;
  eyebrow: ReactNode;
  clock: ReactNode;
  clockSuffix?: ReactNode;
  cycleDots?: CycleDotState[];
  readouts: DialReadout[];
}) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="@container relative aspect-square w-full max-w-[520px]">
        <DialFace progress={progress} />
        {progress.overtimeLaps !== null ? (
          <OvertimeComet laps={progress.overtimeLaps} />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqw]">
          {eyebrow}
          <div className="type-numeral text-[19cqw] whitespace-nowrap">
            {clock}
          </div>
          {clockSuffix ? (
            <div className="-mt-[1cqw] font-mono text-[4cqw] text-primary tabular-nums">
              {clockSuffix}
            </div>
          ) : null}
          {cycleDots ? <CycleDots states={cycleDots} /> : null}
        </div>
      </div>
      <DialReadouts readouts={readouts} />
    </div>
  );
}
