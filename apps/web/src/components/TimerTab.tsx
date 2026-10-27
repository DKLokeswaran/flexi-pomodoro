import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { ActiveTimer } from "./timer/ActiveTimer";
import {
  IdleStartForm,
  type SessionTimingDefaults,
} from "./timer/IdleStartForm";

/** Timer tab: idle start form or the running-session display. */
export function TimerTab({
  snapshot,
  onAction,
  defaults,
}: {
  snapshot: SessionSnapshot | null;
  onAction: (path: string, body?: StartSessionBody) => void;
  defaults: SessionTimingDefaults;
}) {
  const activeSnapshot = snapshot?.status === "active" ? snapshot : null;

  return (
    <section
      className="flex animate-rise flex-col items-center gap-4 pt-8 pb-4 text-center"
      aria-live="polite"
    >
      {!activeSnapshot ? (
        <IdleStartForm
          defaults={defaults}
          onStart={(body) => onAction(SESSION_API.start, body)}
        />
      ) : (
        <ActiveTimer
          snapshot={activeSnapshot}
          onAction={(path) => onAction(path)}
        />
      )}
    </section>
  );
}
