import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  Phase,
  TodayStatsResponse,
  WorkPauseStrategy,
} from "@flexi-pomodoro/shared";
import { UiFlagsProvider } from "../../browserFlags/ui";
import { ActiveTimer } from "../../components/timer/ActiveTimer";
import { todayStatsQueryKey } from "../../queries/useTodayStatsQuery";
import { activeEstimatedSessionEndMs } from "../../utils/activeSessionProjection";
import { formatLocalTime } from "../../utils/time";
import { buildActiveSnapshot, iso } from "../helpers/activeSnapshot";
import { installMemoryLocalStorage } from "../helpers/browserGlobals";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");
const UI_FLAGS_KEY = "flexi-pomodoro:uiFlags";

const PARAMS = {
  workDurationSec: 1500,
  shortRestDurationSec: 300,
  longRestDurationSec: 900,
  cyclesBeforeLongRest: 4,
  decisionWindowSec: 15,
};

function plannedWork(partial: Partial<Phase> = {}): Phase {
  return {
    kind: "planned_work",
    cycleIndex: 1,
    startedAt: iso(START_MS),
    plannedDurationSec: 1500,
    plannedEndAt: iso(START_MS + 1500_000),
    paused: false,
    pausedSec: 0,
    pauseStartedAt: null,
    timerFrozenAt: null,
    ...partial,
  } as Phase;
}

const DECISION: Phase = {
  kind: "decision",
  cycleIndex: 1,
  startedAt: iso(START_MS),
  decisionEndsAt: iso(START_MS + 15_000),
  decisionWindowSec: 15,
};

const EXTENDED: Phase = {
  kind: "extended_work",
  cycleIndex: 1,
  startedAt: iso(START_MS),
};

function rest(kind: "short_rest" | "long_rest"): Phase {
  return {
    kind,
    cycleIndex: 1,
    startedAt: iso(START_MS),
    plannedDurationSec: 300,
    plannedEndAt: iso(START_MS + 300_000),
  };
}

/** Render ActiveTimer to HTML with the wall clock at nowMs. */
function renderTimer(options: {
  phase: Phase;
  nowMs: number;
  liveStats?: Parameters<typeof buildActiveSnapshot>[0]["liveStats"];
  pauseStrategy?: WorkPauseStrategy;
  today?: TodayStatsResponse;
}): { html: string; text: string; buttons: string[] } {
  mock.timers.setTime(options.nowMs);
  const snapshot = buildActiveSnapshot({
    phase: options.phase,
    params: PARAMS,
    serverNowMs: options.nowMs,
    liveStats: options.liveStats,
    pauseStrategy: options.pauseStrategy,
  });
  const queryClient = new QueryClient();
  if (options.today) {
    queryClient.setQueryData(todayStatsQueryKey, options.today);
  }
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        UiFlagsProvider,
        null,
        createElement(ActiveTimer, { snapshot, onAction: () => {} }),
      ),
    ),
  );
  const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(
    (match) => match[1],
  );
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ : /g, ":");
  return { html, text, buttons };
}

describe("ActiveTimer", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = installMemoryLocalStorage();
    mock.timers.enable({ apis: ["Date"], now: START_MS });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it("shows only the actions allowed in each phase", () => {
    const cases: Array<{
      name: string;
      phase: Phase;
      pauseStrategy?: WorkPauseStrategy;
      buttons: string[];
    }> = [
      { name: "running work", phase: plannedWork(), buttons: ["Soft pause"] },
      {
        name: "running work (hard)",
        phase: plannedWork(),
        pauseStrategy: "hard",
        buttons: ["Hard pause (experimental)"],
      },
      {
        name: "paused work",
        phase: plannedWork({
          paused: true,
          pauseStartedAt: iso(START_MS),
        } as Partial<Phase>),
        buttons: ["Resume"],
      },
      {
        name: "decision",
        phase: DECISION,
        buttons: ["Continue working", "Acknowledge rest"],
      },
      { name: "extended work", phase: EXTENDED, buttons: ["Start rest"] },
      { name: "short rest", phase: rest("short_rest"), buttons: [] },
      {
        name: "short-rest ack",
        phase: { ...DECISION, kind: "short_rest_ack" },
        buttons: ["Acknowledge"],
      },
      {
        name: "long rest",
        phase: rest("long_rest"),
        buttons: ["End long rest early"],
      },
    ];
    for (const { name, phase, pauseStrategy, buttons } of cases) {
      const rendered = renderTimer({ phase, pauseStrategy, nowMs: START_MS });
      assert.deepEqual(rendered.buttons, buttons, name);
    }
  });

  it("hides Continue working when the browser preference is on", () => {
    storage.set(
      UI_FLAGS_KEY,
      JSON.stringify({ flags: { hideContinueButton: true } }),
    );
    const { buttons } = renderTimer({ phase: DECISION, nowMs: START_MS });
    assert.deepEqual(buttons, ["Acknowledge rest"]);
  });

  it("running work shows the countdown, cycle, estimated end and live totals", () => {
    const nowMs = START_MS + 600_000;
    const phase = plannedWork();
    const { text } = renderTimer({
      phase,
      nowMs,
      liveStats: { workedSec: 600 },
    });
    const estimatedEnd = formatLocalTime(
      activeEstimatedSessionEndMs(
        buildActiveSnapshot({ phase, params: PARAMS, serverNowMs: nowMs }),
        nowMs,
      ),
    );
    assert.match(text, /Work /);
    assert.match(text, /15:00/);
    assert.match(text, /Cycle 1 \/ 4/);
    assert.ok(text.includes(`Estimated end ${estimatedEnd}`), text);
    assert.match(text, /Worked 10:00/);
  });

  it("paused work labels the pause and stops showing a phase end time", () => {
    const { text } = renderTimer({
      phase: plannedWork({
        paused: true,
        pauseStartedAt: iso(START_MS + 60_000),
      } as Partial<Phase>),
      nowMs: START_MS + 90_000,
    });
    assert.match(text, /Work · soft-paused/);
    assert.match(text, /Phase ends Paused/);
  });

  it("extended work shows the planned length plus overtime and an open end", () => {
    const { text } = renderTimer({
      phase: EXTENDED,
      nowMs: START_MS + 192_000,
    });
    assert.match(text, /Extended work/);
    assert.match(text, /25:00/);
    assert.match(text, /\+ 03:12/);
    assert.match(text, /Phase ends Open/);
    assert.match(text, /Overtime — start rest when ready/);
  });

  it("decision shows the time left before rest starts", () => {
    const { text } = renderTimer({ phase: DECISION, nowMs: START_MS + 5_000 });
    assert.match(text, /Keep working — or rest in 00:10/);
  });

  it("Today row adds the open phase to the server's closed totals", () => {
    const today: TodayStatsResponse = {
      clientDate: "2026-07-12",
      dayStart: "2026-07-12T00:00:00.000Z",
      dayEnd: "2026-07-13T00:00:00.000Z",
      workedSec: 3600,
      deliberationSec: 0,
      restSec: 0,
      pausedSec: 0,
    };
    const { text } = renderTimer({
      phase: plannedWork(),
      nowMs: START_MS + 600_000,
      liveStats: { workedSec: 600 },
      today,
    });
    assert.match(text, /Today Worked 01:10:00/);
  });
});
