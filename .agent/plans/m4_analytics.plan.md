---
name: M4 Analytics
overview: "Implement M4: an Analytics tab with a Calendar view (year heatmap, two streaks, current week and month dashboard with deltas) and a Ranges view (Today, 7 days, 30 days, All, Last week, Last month). Reshapes daily_stats into per-day time splits and counts, stores a day only after every session running during it has ended, keeps totals exact across timezone changes, and does all aggregation in AnalyticsService behind a heatmap endpoint and a summary endpoint."
todos:
  - id: shared-contract
    content: Add ANALYTICS_API.heatmap and .summary, AnalyticsPeriod, HeatmapResponse, SummaryResponse, PeriodStats, ChartPoint and Streaks to packages/shared
    status: pending
  - id: daily-stats-migration
    content: Migration adding eight value columns and statsVersion to daily_stats and dropping workedSec and restSec
    status: pending
  - id: day-bounds
    content: Chained day bounds in clientDay.ts (a day starts where the previous stored day ended)
    status: pending
  - id: day-compute
    content: AnalyticsStore queries and one AnalyticsService day computation for the time splits and owned counts
    status: pending
  - id: store-due-days
    content: Wait rule in finalizeDueDays and the one-time rebuild of version 1 rows
    status: pending
  - id: server-aggregation
    content: Pure period, summary, streak and chart-point modules under apps/server/src/services/analytics with tests
    status: pending
  - id: endpoints
    content: GET /api/analytics/heatmap and GET /api/analytics/summary; today endpoint switched to the open day
    status: pending
  - id: web-queries
    content: Fetch helpers and query hooks for heatmap and summary with mount, phase-change and focus refetch
    status: pending
  - id: analytics-tab-shell
    content: AnalyticsTab with Calendar and Ranges sub-views; remove AnalyticsStub
    status: pending
  - id: heatmap-streaks
    content: ActivityHeatmap, year picker, tooltip, StreakSummary
    status: pending
  - id: tiles-charts
    content: StatTiles with deltas, FocusChart and SessionsChart (shadcn chart) in bar and area forms
    status: pending
  - id: tests-smoke
    content: Server and web unit tests from the test table; manual smoke
    status: pending
  - id: docs
    content: Update PRD, roadmap, technical docs and the About tab
    status: pending
isProject: false
---

# M4 – Analytics

Sources: [docs/product/PRD.md](docs/product/PRD.md) §4.8 (FR-AN-4, FR-AN-5, FR-AN-6), [docs/product/roadmap.md](docs/product/roadmap.md). Prerequisite: [M3.5 idle today stats](.cursor/plans/m3.5_idle_today_stats.plan.md) is complete. Read [AGENTS.md](AGENTS.md) and [apps/web/DESIGN.md](apps/web/DESIGN.md) before any work in `apps/web`.

## Current gap

- The Analytics tab renders `AnalyticsStub` from [`Stubs.tsx`](apps/web/src/components/Stubs.tsx).
- `daily_stats` stores only `workedSec`, `deliberationSec`, `restSec`, `pausedSec` per day. It has no planned and extended split, no short and long rest split, and no cycle or session counts.
- [`AnalyticsService.finalizeDueDays`](apps/server/src/services/analytics.service.ts) writes a day at midnight from closed phases only. A phase still open at midnight never gets its pre-midnight seconds stored. Nothing displays stored days yet, so this is invisible until M4 reads them.
- A timezone change can make the day of the change overlap a stored day or leave a gap after it.
- The only analytics endpoint is `GET /api/analytics/today`.
- `apps/web` has no chart library and no tooltip component.

## Scope

**In:**

- Analytics tab with two sub-views, Calendar (default) and Ranges
- Calendar view with a year heatmap, two streaks, and a dashboard for the current week or current month
- Ranges view with six presets
- Stat tiles and two charts, shared by both views
- Reshaped `daily_stats`, the wait rule for storing days, the timezone seam rule, and a one-time rebuild of existing rows
- `GET /api/analytics/heatmap` and `GET /api/analytics/summary`, with every multi-day calculation done on the server
- Unit tests, manual smoke, and doc updates

**Out:**

- Paging to earlier weeks or months in the Calendar view
- A custom date range picker. The server logic is built on date spans so one can be added later without changing it
- Pagination. No response grows with history beyond the caps stated under API
- Clicking a heatmap cell, per-day drill-down, keyboard navigation between heatmap cells
- Per-second ticking on the Analytics tab, and adding open-phase progress to Analytics numbers
- A list of past sessions
- Export, goals or targets, tags or projects
- Showing deliberation time anywhere on the Analytics tab
- Weekly or monthly rollup tables, and weekly or monthly chart points
- Rebuilding stored days when the timezone setting changes
- Changing the Today row or the live session row on the timer tab

## Definitions (locked)

| Term | Meaning |
| --- | --- |
| Day | One row of analytics data with a label `clientDate` (`YYYY-MM-DD`) and a half-open window `[dayStart, dayEnd)` |
| Stored day | A day that has a row in `daily_stats`. A stored day never changes after it is written, except by the one-time rebuild |
| Pending day | A day after the last stored day that is not stored yet. Its values are computed from the raw tables on every request |
| Open day | The pending day whose window contains the current instant. This is "today" everywhere in the app |
| Worked seconds | `plannedWorkSec + extendedWorkSec` for a day. Always derived, never stored |
| Cycle | Starts when a `planned_work` phase starts and ends when the `rest` phase with the same `sessionId` and `cycleIndex` ends. It includes everything in between |
| Completed cycle | A cycle whose `rest` row has a non-null `endedAt`, with any `endedReason` |
| Extended cycle | A completed cycle that has an `extended_work` row with the same `sessionId` and `cycleIndex`. A cycle extends at most once |
| Completed session | A `sessions` row with `status = "completed"`. Rows with `interrupted` or `active` are never counted as sessions |
| Day worked | A day whose worked seconds are above 0 |
| Cycle day | A day with `cyclesCompleted` above 0 |
| Week | Monday through Sunday. There is no setting for this |
| Span | An inclusive pair of day labels, `from` and `to` |

## Counting rules (locked)

Two kinds of value exist, and they follow different rules.

**Time values** are split at day boundaries. Only seconds inside `[dayStart, dayEnd)` count toward a day. Only closed rows count. This is the overlap clipping M3.5 already uses.

**Count values** are never split. Each counted thing belongs to exactly one day, the day whose window contains its start instant.

| Thing | Owning day | Counted when |
| --- | --- | --- |
| Completed cycle | Day containing its `planned_work.startedAt` | Its rest has ended |
| Extended cycle | Same day as its cycle | Its rest has ended |
| Completed session | Day containing `sessions.startedAt` | The session status is `completed` |

Example. A session starts Monday 22:00. Its cycle 3 starts Tuesday 00:10 and extends. The session counts on Monday. Cycle 3 and its extension count on Tuesday. The hours of every phase are split at midnight as usual.

Session status never affects cycle counts. A completed cycle inside an interrupted session still counts as a cycle, and its hours still count.

A phase's hours appear as soon as that phase closes. A cycle appears in counts only when its rest closes. A session appears only when it completes. So in the middle of a cycle, focus time can include a work block whose cycle is not counted yet. This is intended.

## Per-day values (locked)

The migration drops `workedSec` and `restSec` from `daily_stats` and adds the columns below. `deliberationSec` and `pausedSec` stay with their M3.5 definitions. All new columns are integers, not null, default 0.

| Column | Kind | Definition |
| --- | --- | --- |
| `plannedWorkSec` | time | Closed `planned_work` clipped to the day, minus closed `pause_slices` of that phase clipped to the day |
| `extendedWorkSec` | time | Closed `extended_work` clipped to the day |
| `shortRestSec` | time | Closed `rest` rows whose phase kind is `short_rest`, clipped to the day |
| `longRestSec` | time | Closed `rest` rows whose phase kind is `long_rest`, clipped to the day |
| `cyclesCompleted` | count | Completed cycles owned by the day |
| `cyclesExtended` | count | Extended cycles owned by the day |
| `extendedCycleSec` | owned time | Sum of the full, unclipped duration of the `extended_work` rows of the day's extended cycles |
| `sessionsCompleted` | count | Completed sessions owned by the day |
| `completedSessionCycles` | count | Number of completed cycles belonging to the day's completed sessions, whatever day those cycles started |
| `statsVersion` | marker | Default 1. Rows written by M4 code carry 2 |

`extendedWorkSec` and `extendedCycleSec` are different on purpose. The first is clock time split at midnight and feeds focus time and charts. The second is the whole length of the extensions the day owns and feeds only the average extended duration. Example. A cycle starts Monday 23:00 and extends from 23:50 to 00:30. Monday has `extendedWorkSec` of 10 minutes, `cyclesExtended` 1 and `extendedCycleSec` of 40 minutes. Tuesday has `extendedWorkSec` of 30 minutes and zero for the other two.

`completedSessionCycles` exists for the same reason. The average cycles per session divides it by `sessionsCompleted`, and both follow session ownership.

The today endpoint still returns `workedSec` and `restSec`. The server derives them as the sums of their two parts.

## Day windows and the timezone seam (locked)

Day windows are chained. Each day starts at the exact instant the previous day ended.

- The first pending day has the label of the last stored day plus one calendar day. Its `dayStart` is the last stored day's `dayEnd`.
- A day's `dayEnd` is midnight at the end of its label date in the current `settings.timezone`. If that instant is not after `dayStart`, `dayEnd` equals `dayStart` and the day has zero length and all-zero values.
- Each later pending day starts at the previous pending day's `dayEnd`.
- The open day is the first pending day whose `dayEnd` is after the current instant.
- When `daily_stats` is empty and closed phases exist, the first day's label is the client date of the earliest closed phase start in the current timezone, and its `dayStart` is that date's midnight in the current timezone.
- When `daily_stats` is empty and no closed phases exist, the existing M3.5 behaviour stays. Yesterday is stored as an all-zero row.

With no timezone change this produces the same windows as today, because the previous day already ended at midnight.

Guarantee after a timezone change. Every second belongs to exactly one day, no label appears twice, and only the day during which the change happened is shorter or longer than 24 hours. Stored days are not rewritten.

Example, westward. Timezone is `Asia/Kolkata` and Monday is stored, ending at Tuesday 00:00 IST. On Tuesday 10:00 IST the user switches to `America/New_York`, where the clock reads Monday 23:30. The open day keeps the label Tuesday, starts where Monday ended, and ends at New York's midnight between Tuesday and Wednesday. Tuesday is 33.5 hours long. Anything done in those first 30 minutes is recorded on Tuesday.

Example, extreme eastward. Timezone is UTC−12 and Monday is stored. One minute after midnight the user switches to UTC+14, where the clock reads Wednesday 02:01. Tuesday's midnight in the new timezone is already before Tuesday's start, so Tuesday is a zero-length day with all-zero values, and Wednesday is 22 hours long.

A zero-length day must behave like any other all-zero day. It appears in responses, draws as an empty heatmap cell and an empty chart point, and breaks both streaks.

## Storing days: the wait rule (locked)

A pending day that is no longer the open day becomes a stored day only when no active session started before that day's `dayEnd`. Days are stored in label order, so a blocked day also blocks every later day.

`finalizeDueDays` keeps its name and its two existing triggers, and applies this rule.

- Once at boot, after session hydrate and recovery.
- On a scheduler tick where the client date changed since the previous tick.

No other trigger is added. A day blocked at midnight is stored at the next trigger where it is no longer blocked. Until then its values are computed from the raw tables.

Example. A session runs Monday 23:00 to Tuesday 00:40. At midnight Monday is not stored because the session is active and started before Monday's end. Monday's values are computed from the raw tables through Tuesday. At the next midnight both Monday and Tuesday are stored.

## One-time rebuild (locked)

At boot, before `finalizeDueDays`, every row with `statsVersion` below 2 is recomputed from the raw tables using that row's own stored `dayStart` and `dayEnd`, then written back with `statsVersion` 2. The row's label and window do not change.

The rebuild is idempotent. A second boot finds no version 1 rows and does nothing.

The rebuild has no special handling for a session that is active at that boot. If the server is upgraded while a session that crossed midnight is still running, the previous day can be stored without part of one open work block. This is accepted.

## Periods (locked)

Every period resolves to a span. One function turns a period name into a span, and every other piece of summary logic takes only a span. `today` means the open day's label. A label in a span with no day data counts as an all-zero day.

| Period | Value in the API | `from` | `to` |
| --- | --- | --- | --- |
| Today | `today` | today | today |
| This week | `week` | Monday of the week containing today | today |
| This month | `month` | 1st of today's month | today |
| 7 days | `7d` | today minus 6 days | today |
| 30 days | `30d` | today minus 29 days | today |
| All | `all` | label of the earliest stored day, or today when none is stored | today |
| Last week | `last_week` | Monday of the previous week | Sunday of the previous week |
| Last month | `last_month` | 1st of the previous month | last day of the previous month |

**Comparison spans** exist only for `week` and `month` and cover the same number of elapsed days.

- `week` compares with the previous week from its Monday through the same weekday as today.
- `month` compares with the previous month from its 1st through the same day of the month as today. If the previous month is shorter, the comparison ends on its last day. On 31 March the comparison is 1 to 28 February, or 1 to 29 February in a leap year.

Date arithmetic works on `YYYY-MM-DD` labels only.

## Stats (locked)

`PeriodStats` is computed over one span from the summed day values. Values with a zero divisor are `null`.

| Field | Formula | Rounding |
| --- | --- | --- |
| `focusSec` | Σ worked seconds | none |
| `plannedWorkSec`, `extendedWorkSec` | Σ of each | none |
| `cyclesCompleted`, `cyclesExtended` | Σ of each | none |
| `extendedRatePct` | Σ `cyclesExtended` ÷ Σ `cyclesCompleted` × 100, `null` when no completed cycles | two decimal places |
| `avgExtendedSec` | Σ `extendedCycleSec` ÷ Σ `cyclesExtended`, `null` when no extended cycles | nearest second |
| `restSec`, `shortRestSec`, `longRestSec` | `restSec` is the sum of the other two | none |
| `pausedSec` | Σ `pausedSec` | none |
| `sessionsCompleted` | Σ `sessionsCompleted` | none |
| `avgCyclesPerSession` | Σ `completedSessionCycles` ÷ Σ `sessionsCompleted`, `null` when no sessions | two decimal places |
| `daysInPeriod` | number of labels in the span | none |
| `daysWorked` | number of days worked in the span | none |
| `cycleDays` | number of cycle days in the span | none |
| `avgPerWorkedDaySec` | `focusSec` ÷ `daysWorked`, `null` when `daysWorked` is 0 | nearest second |
| `avgPerDaySec` | `focusSec` ÷ `daysInPeriod` | nearest second |
| `bestDay` | label and worked seconds of the day with the most worked seconds. Ties go to the most recent day. `null` when every day is zero | none |

Every value that is not a whole number is rounded to two decimal places. That covers `extendedRatePct` and `avgCyclesPerSession`. Averages measured in seconds are rounded to the nearest second, because the app displays durations in hours and minutes. The web app shows a two-decimal value without trailing zeros, so `25`, `25.4` and `33.33` are all valid displays.

**Streaks** are computed on the server over the whole history, stored and pending days together.

| Streak | A day qualifies when |
| --- | --- |
| Work streak | it is a day worked |
| Cycle streak | it is a cycle day |

- Longest is the longest run of consecutive qualifying days in the history.
- Current is the run of consecutive qualifying days ending today. If today does not qualify yet, current is the run ending yesterday. Today cannot break a streak until it is over.
- The two streaks can differ by design. A session that runs past midnight gives the next day worked time but may give it no cycle.

## API (locked)

All multi-day calculation happens in the server. The web app formats and draws.

### `GET /api/analytics/heatmap` (`ANALYTICS_API.heatmap`)

Query parameter `year` is optional, a four-digit year.

- Without `year`, the span runs from the Monday 52 weeks before the Monday of today's week through today. That is at most 371 days.
- With `year`, the span runs from 1 January through 31 December of that year, ending at today when that is earlier.
- A `year` that is not four digits, is after today's year, or is before `firstYear` returns 400 with the existing error shape.

Response `HeatmapResponse`:

| Field | Meaning |
| --- | --- |
| `todayClientDate` | Label of the open day |
| `from`, `to` | The span returned |
| `firstYear` | Calendar year of the earliest stored day, or today's year when none is stored |
| `days` | One entry per label in the span, ascending, each with `clientDate` and `workedSec` |
| `streaks` | `work` and `cycle`, each with `current` and `longest`, in days |

### `GET /api/analytics/summary` (`ANALYTICS_API.summary`)

Query parameter `period` is required and is one of the eight values in the Periods table. Any other value returns 400 with the existing error shape. The route accepts no dates in M4.

Response `SummaryResponse`:

| Field | Meaning |
| --- | --- |
| `period` | The requested value |
| `todayClientDate` | Label of the open day |
| `from`, `to` | The resolved span |
| `stats` | `PeriodStats` for the span |
| `comparison` | `PeriodStats` for the comparison span when `period` is `week` or `month`, otherwise `null` |
| `chart.points` | `ChartPoint[]`, ascending, one per day. Empty for `today` |
| `chart.truncated` | `true` only when the span is longer than 366 days |

`ChartPoint` has `clientDate`, `plannedWorkSec`, `extendedWorkSec` and `sessionsCompleted`.

Chart point rules:

- `week` returns exactly seven points, Monday to Sunday. `month` returns one point for every day of the calendar month. Points after today have `null` for the three values.
- Every other period returns one point per day of its span.
- When the span is longer than 366 days, only the most recent 366 days are returned as points. `stats` still covers the whole span.

The largest responses are 371 heatmap entries and 366 chart points, whatever the length of the history.

### `GET /api/analytics/today`

The response shape is unchanged. Its `clientDate`, `dayStart` and `dayEnd` now come from the open day, so the timer tab's Today row and the Analytics tab always describe the same window.

## UI (locked)

### Tab structure

- `AnalyticsTab` replaces `AnalyticsStub`. `Stubs.tsx` is deleted.
- A two-option switch at the top selects Calendar or Ranges. Calendar is the default. The choice is component state and resets on reload.
- The page stays inside the existing 42rem app column.

### Calendar view, top to bottom

1. Activity heatmap with its year picker
2. Streak summary
3. Switch between Week and Month, default Week
4. Stat tiles for the selected period, with deltas
5. Focus chart
6. Sessions chart

The Calendar view shows only the current week and the current month. It has no way to move to an earlier one.

### Ranges view, top to bottom

1. Preset switch in this order: Today, 7 days, 30 days, All, Last week, Last month. Default is 7 days
2. Stat tiles for the selected preset, without deltas
3. Focus chart and Sessions chart. Neither renders for Today

### Activity heatmap

- Cell value is the day's `workedSec` from the heatmap response.
- Seven rows, Monday at the top and Sunday at the bottom. One column per week.
- The default view has 53 week columns, the last being the week that contains today. Days after today are not rendered.
- Month labels sit above the column where each month begins. Weekday labels `Mon`, `Wed`, `Fri` sit on the left.
- A legend reads `Less`, five sample cells, `More`.
- Cells are 9px squares with a 2px gap and a 2px radius, per `DESIGN.md`.

Colour levels are fixed and never depend on the user's data.

| Level | Hours worked | Cell colour |
| --- | --- | --- |
| 0 | 0 | `color-mix(in srgb, var(--foreground) 5%, transparent)` |
| 1 | more than 0, under 2h | `--primary` mixed at 30% into the level 0 colour |
| 2 | 2h to under 4h | `--primary` at 55% |
| 3 | 4h to under 6h | `--primary` at 80% |
| 4 | 6h or more | `--primary` at 100% |

- Hovering a cell shows a tooltip with the duration and the full date, for example `3h 20m on Thu, 12 Nov 2026`. A zero day reads `No work on Thu, 12 Nov 2026`. Each cell carries the same text as its `aria-label`.
- Cells do nothing on click.
- On widths where the grid does not fit, the grid scrolls horizontally inside its own container, and the container opens scrolled to the newest week. The page itself never scrolls horizontally.
- The heatmap layout does not animate, per `DESIGN.md`.

**Year picker.** Rendered only when `firstYear` is before today's year. Options are `Last 12 months` (default) followed by each calendar year from today's year down to `firstYear`. Choosing a year requests the heatmap with that `year`.

### Streak summary

Two labelled pairs beside or below the heatmap. `Work streak` shows current and longest. `Cycle streak` shows current and longest. Values are in days and come from the heatmap response.

### Stat tiles

Tiles follow the Stats component in `DESIGN.md`. Grid of two columns, three from the `sm` breakpoint. Durations use the same formatter as the Today row. A `null` value shows `—`.

| Order | Label | Main value | Second line | Delta compares |
| --- | --- | --- | --- | --- |
| 1 | Focus | `focusSec` | planned and extended durations | `focusSec` |
| 2 | Extended | `N of M cycles (P%)` from `cyclesExtended`, `cyclesCompleted`, `extendedRatePct` | `avgExtendedSec` | `extendedRatePct` |
| 3 | Rest | `restSec` | short and long durations | `restSec` |
| 4 | Paused | `pausedSec` | none | `pausedSec` |
| 5 | Sessions | `sessionsCompleted` | `avgCyclesPerSession` | `sessionsCompleted` |
| 6 | Active days | `Days worked A of D` from `daysWorked`, `daysInPeriod` | `Cycle days C of D` from `cycleDays` | `daysWorked` |
| 7 | Daily average | `avgPerWorkedDaySec`, labelled per day worked | `avgPerDaySec`, labelled per day | `avgPerWorkedDaySec` |
| 8 | Best day | that day's worked duration | that day's date | best day's worked duration |

Tiles 6, 7 and 8 do not render for Today.

**Deltas** render only in the Calendar view, on every tile. The web app computes each delta as the value in `stats` minus the same value in `comparison`.

| Value type | Shown as |
| --- | --- |
| Duration | signed duration, for example `+2h 10m` or `−45m` |
| Count | signed count, for example `+2` |
| Extended rate | signed percentage points, for example `+8 pts` or `+0.8 pts` |
A delta that is not a whole number is rounded to two decimal places after the subtraction. A delta shows `—` when either side is `null`. Each delta is followed by `vs last week` or `vs last month`. Deltas use muted text and no extra colour.

### Charts

Both charts use the shadcn `chart` component, which adds Recharts. The chart form depends only on the number of points returned.

| Points returned | Focus chart | Sessions chart |
| --- | --- | --- |
| 7 or fewer | stacked bars, planned below and extended above | bars |
| more than 7 | stacked area, planned below and extended above | area |

| Series | Colour |
| --- | --- |
| Planned | `--chart-1` |
| Extended | `--chart-2` |
| Sessions | `--chart-3` |

- The Focus chart's vertical axis is hours. The Sessions chart's vertical axis is a count.
- There is always one point per day. Days with no work stay in the series as zero, so long spans show a sawtooth. This is intended.
- A point with `null` values draws nothing. In the Month view the area ends at today and the horizontal axis still covers the whole month.
- When `chart.truncated` is `true`, a note under the charts reads `Showing the most recent 366 days`.

Resulting forms per period:

| Period | Form |
| --- | --- |
| This week, 7 days, Last week | bars |
| This month, 30 days, Last month, All | area |
| Today | no charts |

### Refresh

The heatmap and summary queries refetch when the Analytics tab mounts, when the session phase changes (the same phase key the Today row uses), and when the window regains focus. Nothing on the Analytics tab runs on a timer.

## Execution order

### 1. Shared contract

**File:** [`packages/shared/src/index.ts`](packages/shared/src/index.ts)

- Add `ANALYTICS_API.heatmap` (`/api/analytics/heatmap`) and `ANALYTICS_API.summary` (`/api/analytics/summary`).
- Add `AnalyticsPeriod`, `HeatmapResponse`, `SummaryResponse`, `PeriodStats`, `ChartPoint` and `Streaks` with exactly the fields listed under API and Stats.

### 2. Migration

**New:** `apps/server/src/db/migrations/20261113120000_daily_stats_m4.ts`

- Add the ten columns from the per-day values table and drop `workedSec` and `restSec`. The `down` migration reverses both.

### 3. Chained day bounds

**File:** [`apps/server/src/utils/clientDay.ts`](apps/server/src/utils/clientDay.ts)

- Add a helper that returns the window for a label given the previous day's `dayEnd` and the timezone, following the day window rules. `dayBoundsIso` stays for the empty-table case.

### 4. Day computation

**Files:** [`analyticsStore.ts`](apps/server/src/db/stores/analyticsStore.ts), [`analytics.service.ts`](apps/server/src/services/analytics.service.ts)

- Store gains queries for closed rests with their phase kind, completed cycles whose planned work started inside a window (with whether they extended and the extended duration), completed sessions that started inside a window with their completed cycle count, the active session's `startedAt`, `daily_stats` rows for a label range, and rows below a given `statsVersion`.
- Service gains one function that computes every per-day value for a given window. Pending days, storing and the rebuild all use it.
- `DailyStatsRow` and `upsertDailyStats` match the new columns and write `statsVersion` 2.

### 5. Storing days

**File:** [`analytics.service.ts`](apps/server/src/services/analytics.service.ts), [`app.ts`](apps/server/src/app.ts)

- `finalizeDueDays` applies the wait rule and the chained windows.
- Add the rebuild and call it at boot before `finalizeDueDays`.

### 6. Server aggregation

**New folder:** `apps/server/src/services/analytics/`

| File | Responsibility |
| --- | --- |
| `periods.ts` | Period name to span, and the comparison span |
| `summary.ts` | `PeriodStats` from a list of days |
| `streaks.ts` | Current and longest for both streaks |
| `chartPoints.ts` | Chart points for a span, including the full-week and full-month padding and the 366-day cap |

These are pure functions over day values. They read no database and no clock. `AnalyticsService` loads the days for a span, stored and pending together, and calls them.

### 7. Endpoints

**Files:** [`analytics.service.ts`](apps/server/src/services/analytics.service.ts), [`analytics.routes.ts`](apps/server/src/routes/analytics.routes.ts)

- Add the heatmap and summary service methods and register both routes with their parameter validation.
- Point `todayStats` at the open day and derive `workedSec` and `restSec`.

### 8. Web queries

**Files:** [`analytics.api.ts`](apps/web/src/queries/analytics.api.ts), new `useHeatmapQuery.ts` and `useSummaryQuery.ts` in `apps/web/src/queries/`

- Query keys are `["analytics", "heatmap", year or "recent"]` and `["analytics", "summary", period]`.
- Both hooks apply the refresh rules. Export the existing phase key helper from `useTodayStatsQuery.ts` and reuse it.

### 9. Tab shell

**Files:** new `apps/web/src/components/AnalyticsTab.tsx`, [`App.tsx`](apps/web/src/App.tsx), delete [`Stubs.tsx`](apps/web/src/components/Stubs.tsx)

- `App` passes the current phase to `AnalyticsTab`.
- New `apps/web/src/components/analytics/SegmentedSwitch.tsx`, one control used for Calendar and Ranges, Week and Month, the range presets, and the year picker.
- New `CalendarView.tsx` and `RangesView.tsx` in the same folder.
- Loading and error states follow the pattern `App` uses for the settings query.

### 10. Heatmap and streaks

**New:** `ActivityHeatmap.tsx`, `StreakSummary.tsx` in `apps/web/src/components/analytics/`, and `apps/web/src/utils/analytics/heatmap.ts`

- `heatmap.ts` holds the pure layout logic: week columns, month label positions, and the level for a `workedSec` value.
- Add the shadcn `tooltip` component through the shadcn CLI.
- The heatmap is a hand-built CSS grid. It does not use the chart library.

### 11. Tiles and charts

**New:** `StatTiles.tsx`, `FocusChart.tsx`, `SessionsChart.tsx` in `apps/web/src/components/analytics/`, and `apps/web/src/utils/analytics/delta.ts`

- `delta.ts` holds the pure delta calculation and its three display formats.
- Add the shadcn `chart` component through the shadcn CLI.

### 12. Tests and smoke

Server tests extend the existing analytics test files and add one file per module in `apps/server/src/services/analytics/`. Web tests go in `apps/web/src/tests/utils/` and cover `heatmap.ts` and `delta.ts`.

| Case | Expect |
| --- | --- |
| Planned and extended split | pause time removed from planned only |
| Short and long rest split | each rest lands in the column for its phase kind |
| Cycle started before midnight, rest ends after | cycle counted on the first day only, hours split across both |
| Extension crossing midnight | `extendedWorkSec` split across both days, `extendedCycleSec` whole on the owning day |
| Session started Monday, cycle 3 started Tuesday and extended | session on Monday, cycle and extension on Tuesday |
| Cycle whose rest is still open | hours of its closed phases counted, cycle not counted |
| Interrupted session with one completed cycle | 0 sessions, 1 cycle |
| Session active across midnight | previous day not stored at midnight, stored at the next trigger after the session ends, with full values |
| Phase open at midnight | its pre-midnight seconds are in the stored day |
| Timezone moved west during a day | no duplicate label, open day longer than 24h, total seconds unchanged |
| Timezone moved east during a day | no second counted in two days, the change day shorter than 24h |
| Timezone moved from UTC−12 to UTC+14 | one zero-length day with all-zero values, no error, both streaks broken on it |
| Rebuild | version 1 rows get the new columns and version 2 with unchanged windows. A second run changes nothing |
| Today endpoint | `workedSec` and `restSec` equal the sums of their parts, and the window equals the open day |
| Period spans | every row of the Periods table for a fixed today |
| Week comparison on a Wednesday | Monday to Wednesday of the previous week |
| Month comparison on 31 March | 1 February to the last day of February |
| Extended rate with no completed cycles | `null` |
| Extended rate with 1 of 3 cycles extended | `33.33` |
| Best day tie | the most recent day |
| Days worked and cycle days differ | a day with worked time and no cycle counts for days worked only |
| Current streak when today has no work yet | counts the run ending yesterday |
| Heatmap default span | starts on a Monday, ends today, at most 371 days |
| Heatmap with `year` | 1 January to 31 December, or to today for the current year. Invalid years return 400 |
| Summary with an unknown `period` | 400 |
| Chart points for `week` on a Wednesday | seven points, the last four with `null` values |
| Chart points for a 400-day `all` span | 366 points, `truncated` true, `stats` covering all 400 days |
| Heatmap levels | 0, 1h59m, 2h, 3h59m, 4h, 5h59m and 6h map to levels 0, 1, 2, 2, 3, 3, 4 |
| Delta with a `null` side | `—` |

**Manual:** Calendar opens by default with heatmap, streaks and Week tiles with deltas. Week shows bars and Month shows areas. Each Ranges preset renders, and Today shows tiles without charts. Finishing a phase on the timer tab changes the numbers on returning to Analytics. Heatmap tooltip shows on hover. The heatmap scrolls inside its container at phone width and opens at the newest week. Timer tab Today row is unchanged.

### 13. Docs

| File | Change |
| --- | --- |
| [docs/product/PRD.md](docs/product/PRD.md) | FR-AN-4 gains the Calendar and Ranges structure, the heatmap, days worked and cycle days, both daily averages, best day and the deltas. FR-AN-5 presets become Today, 7 days, 30 days, All, Last week, Last month. FR-AN-6 describes the bar and area forms. The streak line becomes the work streak and cycle streak definitions. Decision and ack minutes are marked as not displayed. Add the cycle definition to the glossary table. Add a document history row |
| [docs/product/roadmap.md](docs/product/roadmap.md) | M4 row describes the delivered scope |
| [docs/data-model.md](docs/data-model.md) | Reshaped `daily_stats`, chained day windows, the wait rule, the rebuild |
| [docs/api-reference.md](docs/api-reference.md) | The heatmap and summary endpoints, and the open-day wording for the today endpoint |
| [docs/modules.md](docs/modules.md), [docs/structure.md](docs/structure.md), [docs/testing.md](docs/testing.md), [docs/glossary.md](docs/glossary.md), [docs/dependencies.md](docs/dependencies.md) | New files, exports, tests, terms and the Recharts dependency |
| [`apps/web/src/constants/about.ts`](apps/web/src/constants/about.ts) | Analytics dashboard becomes `available`. Update the alpha status sentence |

## Key design decisions

- **Aggregation lives in the server.** `AnalyticsService` computes periods, stats, streaks and chart points. The web app receives finished values and never raw day history.
- **Bounded responses instead of pagination.** A summary is one object, the heatmap is one year, and chart points are capped at 366. Nothing returned is a list a person pages through.
- **Span-based summary logic.** Presets become a span in one place, so a custom range later needs only route parameters and a picker.
- **Per-day rows only, with no derived columns.** One table holds one row per day. Worked and rest totals are sums of their stored parts.
- **Stored days are written once.** The wait rule delays the write until the day can no longer change, so no code path edits old rows.
- **Hours split, counts owned.** Hours follow the clock. Sessions, cycles and extensions belong to the day they started.
- **A cycle ends with its rest.** Cycle counts, the extended rate, cycle days and the cycle streak all use that one definition.
- **Chained day windows.** A timezone change stretches or shrinks one day and leaves every total exact.
- **Fixed heatmap levels.** Hours in a day are bounded, so a colour means the same thing all year.
- **One point per day on every chart.** Bars up to seven points and areas beyond, with no weekly or monthly grouping.
- **Calendar view is a quick dashboard.** It shows only the current week and month. Past periods are reached through the Ranges presets.
