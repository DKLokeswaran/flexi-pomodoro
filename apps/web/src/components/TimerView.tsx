import type { SessionOverrides, SessionSnapshot } from "@flexi-pomodoro/shared";
import { useNow } from "../hooks/useNow";
import { ActiveTimer } from "./ActiveTimer";
import {
  IdleStartForm,
  type SessionTimingDefaults,
} from "./IdleStartForm";

export function TimerView({
  snapshot,
  onAction,
  actionError,
  defaults,
}: {
  snapshot: SessionSnapshot | null;
  onAction: (path: string, body?: SessionOverrides) => void;
  actionError: string | null;
  defaults: SessionTimingDefaults;
}) {
  const active = snapshot?.status === "active";
  const now = useNow(Boolean(active));
  const phase = snapshot?.status === "active" ? snapshot.session.phase : null;
  const params =
    snapshot?.status === "active" ? snapshot.session.params : null;

  return (
    <section className="timer-shell" aria-live="polite">
      {actionError ? <p className="error">{actionError}</p> : null}
      {!active || !phase || !params || !snapshot ? (
        <IdleStartForm
          defaults={defaults}
          onStart={(body) => onAction("/api/session/start", body)}
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
