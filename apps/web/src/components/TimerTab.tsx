import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { useNow } from "../hooks/useNow";
import { ActiveTimer } from "./timer/ActiveTimer";
import {
  IdleStartForm,
  type SessionTimingDefaults,
} from "./timer/IdleStartForm";
import styles from "./TimerTab.module.css";

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
  const sessionIsActive = snapshot?.status === "active";
  const now = useNow(Boolean(sessionIsActive));
  const phase = snapshot?.status === "active" ? snapshot.session.phase : null;
  const params =
    snapshot?.status === "active" ? snapshot.session.params : null;

  return (
    <section className={styles.timerShell} aria-live="polite">
      {!sessionIsActive || !phase || !params || !snapshot ? (
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
