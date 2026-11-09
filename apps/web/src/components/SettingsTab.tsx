import { useEffect, useId, useState, type ReactNode } from "react";
import { type Settings } from "@flexi-pomodoro/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  DEBUG_FEATURE_IDS,
  DEBUG_FEATURE_META,
  useDebugFlags,
} from "../browserFlags/debug";
import {
  UI_FEATURE_IDS,
  UI_FEATURE_META,
  useUiFlags,
} from "../browserFlags/ui";
import { DECISION_WINDOW_LABEL } from "../constants/labels";
import { ianaTimeZones } from "../utils/ianaTimeZones";
import { minutesToSec, secToMinutes } from "../utils/time";
import { NumberField } from "./NumberField";

type SettingsDraft = {
  workMinutes: number;
  shortRestMinutes: number;
  longRestMinutes: number;
  cyclesBeforeLongRest: number;
  decisionWindowSec: number;
  enableHardPause: boolean;
  timezone: string;
};

/** Convert persisted seconds into the minutes-based settings form draft. */
function draftFromSettings(settings: Settings): SettingsDraft {
  return {
    workMinutes: secToMinutes(settings.workDurationSec),
    shortRestMinutes: secToMinutes(settings.shortRestDurationSec),
    longRestMinutes: secToMinutes(settings.longRestDurationSec),
    cyclesBeforeLongRest: settings.cyclesBeforeLongRest,
    decisionWindowSec: settings.decisionWindowSec,
    enableHardPause: settings.workPauseStrategy === "hard",
    timezone: settings.timezone,
  };
}

/** Convert the minutes draft back into a Settings object for PUT. */
function settingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  return {
    ...settings,
    workDurationSec: minutesToSec(draft.workMinutes),
    shortRestDurationSec: minutesToSec(draft.shortRestMinutes),
    longRestDurationSec: minutesToSec(draft.longRestMinutes),
    cyclesBeforeLongRest: draft.cyclesBeforeLongRest,
    decisionWindowSec: draft.decisionWindowSec,
    workPauseStrategy: draft.enableHardPause ? "hard" : "soft",
    timezone: draft.timezone,
  };
}

/** Searchable IANA timezone combobox for analytics day bounds. */
function TimezoneField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const inputId = useId();

  return (
    <Field className="gap-2 text-left" data-disabled={disabled}>
      <FieldLabel
        htmlFor={inputId}
        className="type-label font-normal text-muted-foreground"
      >
        Timezone
      </FieldLabel>
      <Combobox
        items={ianaTimeZones}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <ComboboxInput
          id={inputId}
          placeholder="Search timezones"
          showClear={false}
          className="h-10 w-full"
        />
        <ComboboxContent className="shadow-none">
          <ComboboxEmpty>No timezone found.</ComboboxEmpty>
          <ComboboxList>
            {(zone) => (
              <ComboboxItem key={zone} value={zone}>
                {zone}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription className="text-[13px]">
        IANA zone for today&apos;s day boundaries (e.g. Asia/Kolkata).
      </FieldDescription>
    </Field>
  );
}

/** Mono uppercase label above a group of settings. */
function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="type-label mt-2 text-muted-foreground">{children}</p>;
}

/** Vertical stack of flag checkboxes. */
function FlagList({ children }: { children: ReactNode }) {
  return <FieldGroup className="mt-3 gap-3 text-left">{children}</FieldGroup>;
}

/** Checkbox row with a label and optional muted description. */
function FlagCheckbox({
  label,
  description,
  checked,
  disabled,
  nested = false,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  nested?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checkboxId = useId();

  return (
    <Field
      orientation="horizontal"
      data-disabled={disabled}
      className={cn(nested && "ml-5")}
    >
      <Checkbox
        id={checkboxId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FieldContent>
        <FieldLabel htmlFor={checkboxId} className="font-normal">
          {label}
        </FieldLabel>
        {description ? (
          <FieldDescription className="text-[13px]">
            {description}
          </FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

/** Persistent defaults, browser UI prefs, and browser-local debug flags. */
export function SettingsTab({
  settings,
  onSave,
  locked,
  saving,
}: {
  settings: Settings;
  onSave: (nextSettings: Settings) => void;
  locked: boolean;
  saving?: boolean;
}) {
  const { debugMode, setDebugMode, flags, setFlag } = useDebugFlags();
  const { flags: uiFlags, setFlag: setUiFlag } = useUiFlags();
  const [draft, setDraft] = useState(draftFromSettings(settings));
  /** Session-only UI gate; opens automatically when saved defaults use hard pause. */
  const [experimentalMode, setExperimentalModeState] = useState(
    () => settings.workPauseStrategy === "hard",
  );

  useEffect(() => {
    setDraft(draftFromSettings(settings));
    if (settings.workPauseStrategy === "hard") {
      setExperimentalModeState(true);
    }
  }, [settings]);

  /** Show/hide experimental options; clearing the gate clears hard pause in the draft. */
  const setExperimentalMode = (enabled: boolean) => {
    setExperimentalModeState(enabled);
    if (!enabled) {
      setDraft((current) => ({ ...current, enableHardPause: false }));
    }
  };

  /** Update one numeric draft field, rounded to a whole number. */
  const setRoundedField = (key: keyof SettingsDraft, value: number) => {
    setDraft((current) => ({ ...current, [key]: Math.round(value) }));
  };

  return (
    <section className="flex animate-rise flex-col gap-4">
      <h2 className="type-display text-[2rem]">Settings</h2>
      <p className="text-fg-soft">
        Persistent defaults used when starting without overrides. Edits apply to
        future sessions only.
      </p>
      {locked ? (
        <p className="text-muted-foreground">
          A session is active — defaults stay locked until idle.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 min-[561px]:grid-cols-2">
        <NumberField
          label="Work (min)"
          value={draft.workMinutes}
          step={1}
          onChange={(value) => setRoundedField("workMinutes", value)}
        />
        <NumberField
          label="Short rest (min)"
          value={draft.shortRestMinutes}
          step={1}
          onChange={(value) => setRoundedField("shortRestMinutes", value)}
        />
        <NumberField
          label="Cycles (N)"
          value={draft.cyclesBeforeLongRest}
          step={1}
          onChange={(value) => setRoundedField("cyclesBeforeLongRest", value)}
        />
        <NumberField
          label="Long rest (min)"
          value={draft.longRestMinutes}
          step={1}
          onChange={(value) => setRoundedField("longRestMinutes", value)}
        />
        <NumberField
          label={DECISION_WINDOW_LABEL}
          value={draft.decisionWindowSec}
          step={1}
          min={10}
          onChange={(value) => setRoundedField("decisionWindowSec", value)}
        />
      </div>

      <TimezoneField
        value={draft.timezone}
        disabled={locked}
        onChange={(timezone) => setDraft((current) => ({ ...current, timezone }))}
      />

      <SectionTitle>Experimental features</SectionTitle>
      <FlagList>
        <FlagCheckbox
          label="Enable experimental features"
          description="Unlocks experimental options for this visit."
          checked={experimentalMode}
          onCheckedChange={setExperimentalMode}
        />
        {experimentalMode ? (
          <FlagCheckbox
            nested
            label="Enable hard pause (experimental)"
            description="Off = soft pause (default). On = hard pause."
            checked={draft.enableHardPause}
            disabled={locked}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                enableHardPause: checked,
              }))
            }
          />
        ) : null}
      </FlagList>

      <div className="mt-2 flex flex-wrap justify-start gap-3">
        <Button
          type="button"
          disabled={locked || saving}
          onClick={() => onSave(settingsFromDraft(settings, draft))}
        >
          Save defaults
        </Button>
      </div>

      <SectionTitle>Browser preferences</SectionTitle>
      <FlagList>
        {UI_FEATURE_IDS.map((featureId) => {
          const meta = UI_FEATURE_META[featureId];
          return (
            <FlagCheckbox
              key={featureId}
              label={meta.label}
              description={meta.description}
              checked={Boolean(uiFlags[featureId])}
              onCheckedChange={(checked) => setUiFlag(featureId, checked)}
            />
          );
        })}
      </FlagList>

      <SectionTitle>Debug</SectionTitle>
      <FlagList>
        <FlagCheckbox
          label="Enable debug mode"
          description="Unlocks per-feature debug options for this browser session. Not saved with defaults."
          checked={debugMode}
          onCheckedChange={setDebugMode}
        />
        {debugMode
          ? DEBUG_FEATURE_IDS.map((featureId) => {
              const meta = DEBUG_FEATURE_META[featureId];
              return (
                <FlagCheckbox
                  key={featureId}
                  nested
                  label={meta.label}
                  description={meta.description}
                  checked={Boolean(flags[featureId])}
                  onCheckedChange={(checked) => setFlag(featureId, checked)}
                />
              );
            })
          : null}
      </FlagList>
    </section>
  );
}
