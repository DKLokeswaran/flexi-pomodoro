import { useState } from "react";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import { AboutStub, AnalyticsStub } from "./components/Stubs";
import { SettingsPanel } from "./components/SettingsPanel";
import { Nav, type Tab } from "./components/Nav";
import { TimerView } from "./components/TimerView";
import {
  useSaveSettingsMutation,
  useSessionActionMutation,
  useSettingsQuery,
} from "./hooks/useSessionApi";
import { useSessionStream } from "./hooks/useSessionStream";

export function App() {
  const [tab, setTab] = useState<Tab>("timer");
  const { snapshot, setSnapshot } = useSessionStream();
  const settingsQuery = useSettingsQuery();
  const saveSettings = useSaveSettingsMutation();
  const sessionAction = useSessionActionMutation(setSnapshot);

  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;
  const active = snapshot?.status === "active";

  const actionError =
    sessionAction.error instanceof Error
      ? sessionAction.error.message
      : sessionAction.error
        ? "Request failed"
        : null;

  const saveError =
    saveSettings.error instanceof Error
      ? saveSettings.error.message
      : saveSettings.error
        ? "Save failed"
        : null;

  return (
    <div className="app">
      <h1 className="brand">Flexi Pomodoro</h1>
      <Nav tab={tab} onChange={setTab} />

      {settingsQuery.isError ? (
        <p className="error">
          {settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : "Failed to load settings"}
        </p>
      ) : null}

      {tab === "timer" ? (
        <TimerView
          snapshot={snapshot}
          actionError={actionError}
          defaults={settings}
          onAction={(path, body) =>
            sessionAction.mutate({ path, body })
          }
        />
      ) : null}

      {tab === "settings" ? (
        <SettingsPanel
          settings={settings}
          locked={Boolean(active)}
          saving={saveSettings.isPending}
          error={saveError}
          onSave={(next) => saveSettings.mutate(next)}
        />
      ) : null}

      {tab === "analytics" ? <AnalyticsStub /> : null}
      {tab === "about" ? <AboutStub /> : null}
    </div>
  );
}
