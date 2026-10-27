import { useState } from "react";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import { AboutTab } from "./components/AboutTab";
import { AnalyticsStub } from "./components/Stubs";
import { SettingsTab } from "./components/SettingsTab";
import { Nav, type Tab } from "./components/Nav";
import { TimerTab } from "./components/TimerTab";
import {
  useSaveSettingsMutation,
  useSessionActionMutation,
  useSettingsQuery,
} from "./queries/useSessionApi";
import { useSessionStream } from "./hooks/useSessionStream";
import { errorMessage } from "./utils/errorMessage";

/** Root shell: tab navigation and the selected tab's panel. */
export function App() {
  const [tab, setTab] = useState<Tab>("timer");
  const { snapshot, setSnapshot } = useSessionStream();
  const settingsQuery = useSettingsQuery();
  const saveSettings = useSaveSettingsMutation();
  const sessionAction = useSessionActionMutation(setSnapshot);

  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;
  const sessionIsActive = snapshot?.status === "active";

  return (
    <div className="mx-auto flex min-h-screen max-w-[42rem] flex-col gap-7 px-5 pt-10 pb-12">
      <h1 className="animate-rise type-display text-[clamp(2.25rem,6vw,3.25rem)]">
        <em className="type-serif-italic">Flexi</em> Pomodoro
      </h1>
      <Nav tab={tab} onChange={setTab} />

      {settingsQuery.isError ? (
        <p className="text-destructive">
          {errorMessage(settingsQuery.error, "Failed to load settings")}
        </p>
      ) : null}

      {tab === "timer" ? (
        <TimerTab
          snapshot={snapshot}
          defaults={settings}
          onAction={(path, body) => sessionAction.mutate({ path, body })}
        />
      ) : null}

      {tab === "settings" ? (
        <SettingsTab
          settings={settings}
          locked={Boolean(sessionIsActive)}
          saving={saveSettings.isPending}
          onSave={(nextSettings) => saveSettings.mutate(nextSettings)}
        />
      ) : null}

      {tab === "analytics" ? <AnalyticsStub /> : null}
      {tab === "about" ? <AboutTab /> : null}
    </div>
  );
}
