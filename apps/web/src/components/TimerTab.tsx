import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
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
  const activeSnapshot = snapshot?.status === "active" ? snapshot : null;
  const recoveryAbandonedMessage =
    snapshot?.status === "idle"
      ? snapshot.recoveryAbandonedMessage
      : undefined;

  return (
    <section className={styles.timerShell} aria-live="polite">
      {!activeSnapshot ? (
        <IdleStartForm
          defaults={defaults}
          recoveryAbandonedMessage={recoveryAbandonedMessage}
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
