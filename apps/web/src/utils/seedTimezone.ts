import type { Settings, SettingsPatch } from "@flexi-pomodoro/shared";

/** One-shot gate so a later intentional UTC choice is not overwritten. */
export const TZ_SEEDED_KEY = "flexi-pomodoro:tzSeeded";

let seedInFlight: Promise<Settings | null> | null = null;

/**
 * On first browser visit, persist the resolved IANA zone when settings still
 * use the install default `UTC`. Sets `TZ_SEEDED_KEY` after a successful pass.
 */
export function seedTimezoneIfNeeded(
  settings: Settings,
  save: (patch: SettingsPatch) => Promise<Settings>,
): Promise<Settings | null> {
  if (typeof localStorage === "undefined") return Promise.resolve(null);
  if (localStorage.getItem(TZ_SEEDED_KEY)) return Promise.resolve(null);
  if (seedInFlight) return seedInFlight;

  seedInFlight = (async () => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let next: Settings | null = null;
      if (
        settings.timezone === "UTC" &&
        browserTz &&
        browserTz !== "UTC"
      ) {
        next = await save({ timezone: browserTz });
      }
      localStorage.setItem(TZ_SEEDED_KEY, "1");
      return next;
    } finally {
      seedInFlight = null;
    }
  })();

  return seedInFlight;
}
