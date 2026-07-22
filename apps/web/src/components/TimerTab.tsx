import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { useNow } from "../hooks/useNow";
import { ActiveTimer } from "./timer/ActiveTimer";
import {
  IdleStartForm,
  type SessionTimingDefaults,
} from "./timer/IdleStartForm";

export function TimerTab({
  snapshot,
  onAction,
  defaults,
}: {
  snapshot: SessionSnapshot | null;
  onAction: (path: string, body?: StartSessionBody) => void;
  defaults: SessionTimingDefaults;
}) {
  const active = snapshot?.status === "active";
  const now = useNow(Boolean(active));
  const phase = snapshot?.status === "active" ? snapshot.session.phase : null;
  const params =
    snapshot?.status === "active" ? snapshot.session.params : null;

  return (
    <section className="timer-shell" aria-live="polite">
      {!active || !phase || !params || !snapshot ? (
        <IdleStartForm
          defaults={defaults}
          onStart={(body) => onAction(SESSION_API.start, body)}
        />
      ) : (
        <ActiveTimer
          snapshot={snapshot}
          phase={phase}
          params={params}
          now={now}
          onAction={(path) => onAction(path)}
        />
      )}
    </section>
  );
}
