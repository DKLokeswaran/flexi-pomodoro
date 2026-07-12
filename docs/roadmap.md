# Flexi Pomodoro — Product Roadmap

| Field | Value |
| --- | --- |
| **Product** | Flexi Pomodoro |
| **Document type** | Product roadmap |
| **Version** | 1.1 |
| **Status** | Active |
| **Last updated** | 2026-07-12 (test coverage added to beta → 1.0) |
| **Related** | [PRD](./PRD.md) (alpha scope) |

---

## Release model

| Phase | Intent |
| --- | --- |
| **Alpha** | Build and ship everything defined in the current PRD as a single-user, self-hosted web app |
| **Beta → Stable (1.0)** | Harden the PRD product and add the v1 readiness features below; ship the first production self-hosted release |
| **Post-v1 (likely)** | Near-term work after 1.0 that is expected to be prioritized |
| **Post-v1 (considered)** | Larger product directions that may be pursued after Stable; **not committed** |

Alpha ends when the PRD acceptance criteria are met. Beta begins immediately after that. Stable (1.0) is the first version considered ready for long-term self-hosted production use.

Clients (web UI and any later mobile UI) treat the backend as the source of truth when connected. There is no separate “multi-device sync” product track: connecting to the same backend is how devices share state.

---

## Alpha — current PRD

**Goal:** Deliver the flow-aware Pomodoro variant described in the PRD: committed sessions, decision window / extended work, soft (default) and hard (experimental) pause modules, persistence, analytics, and Docker self-hosting.

**Scope source of truth:** [PRD](./PRD.md) (milestones M1–M5, product-level acceptance criteria).

| Milestone | Focus |
| --- | --- |
| **M1 – Timer core** | Work/rest shapes, defaults & overrides, session lock, decision window, extended work, soft pause, unique alerts, Docker |
| **M2 – Pause modules** | Soft default + hard behind flag; encapsulated, deletable strategies with tests |
| **M3 – Persistence & resume** | SQLite on volume; labeled extended segments; strict wall-clock recovery |
| **M4 – Analytics** | Extended/pause stats and dashboard surfaces |
| **M5 – Polish** | Curated sound pack, mute, reverse-proxy notes |

**Alpha exit:** PRD §13 acceptance criteria satisfied; no intentional PRD P0 gaps remaining.

**Explicitly out of alpha (see PRD non-goals):** built-in auth, multi-user, native mobile apps, SaaS hosting, leaderboards, third-party integrations.

---

## Beta → Stable (1.0)

**Goal:** Make the single-user self-hosted app production-ready and complete the v1 feature set below.

Beta is primarily quality and readiness. The items in this section are in scope for the path to Stable (1.0).

### Readiness and quality

- Bug fixes and edge-case hardening (recovery, multi-tab, audio unlock, soft-pause-at-planned-end)
- UX clarity (defaults vs session overrides, extended-work labeling, alert feedback)
- Ops maturity (health checks, upgrade/migration paths, documented deploy recipes, reverse-proxy / network-isolation notes)
- Real-world soak: multi-day sessions, container restarts, browser refresh mid-session
- Data durability: migrations on upgrade without silent history loss
- Audio trust: unique transition sounds ship; mute; browser autoplay path documented
- Hard-pause decision: keep clearly experimental, or remove if beta shows it is not worth keeping

### Test coverage (beta gate for 1.0)

Alpha milestones ship with focused engine unit tests; beta expands to **good unit test coverage** across the server core before Stable (1.0). Coverage is a release requirement, not a polish item.

**Target areas:**

| Area | What to cover |
| --- | --- |
| **Session engine** | Full state machine (PRD §5): decision ack/timeout/continue, extended work, soft-pause-at-planned-end, cycle chaining, long-rest early end, forbidden transitions |
| **Pause modules** | Soft and hard strategies in isolation; `WorkPauseStrategy` contract; planned-end shift vs unchanged semantics |
| **Recovery** | Strict wall-clock catch-up (PRD Q9 S1–S7): downtime through work, decision, rest, extended work, soft pause |
| **Settings & overrides** | Defaults persistence, session-only overrides, param lock after start, validation bounds |
| **Alerts** | Correct `pendingAlerts` per system boundary; no alarm on manual extended end or early long rest |
| **API routes** | Fastify handlers: happy paths, invalid phase actions, error responses |
| **Analytics** | Aggregation helpers: extended duration/count, soft-paused time, session completion stats |
| **Migrations** | Schema upgrade paths apply cleanly on a fixture DB |

**Stable (1.0) test bar:**

- Critical paths (engine, pause, recovery, alerts) have unit tests with no intentional gaps on P0 PRD rules
- New P0 behavior ships with tests in the same change (no regressions on timer correctness or data integrity)
- CI runs the full unit suite on every merge; failures block release
- UI and Docker remain primarily manual / smoke-tested; beta does not require full E2E automation for 1.0

### v1 features for Stable

| Feature | Intent |
| --- | --- |
| **Tags** | Attach tags (e.g. task / project labels) to sessions or work so analytics can be filtered and reviewed by focus area |
| **CSV import / export** | Export history and settings-friendly data to CSV; import CSV to restore or migrate data between instances |
| **Backup** | Proper backup covering both in-place and online approaches |

**Stable (1.0) means:**

- PRD core technique and analytics are complete and trustworthy
- Tags, CSV import/export, and backup are available
- Data survives restarts and upgrades without manual repair
- Deploy story is clear for homelab / VPS behind a reverse proxy
- Good unit test coverage on server core (engine, pause, recovery, alerts, API, analytics helpers) with CI enforcement
- No known P0 data-loss or incorrect-timer bugs; remaining issues are documented and non-blocking

Work in later sections is **not** required to ship 1.0.

---

## Post-v1 (likely)

Items expected to be picked up after Stable (1.0), ahead of the larger considered themes.

| Item | Intent |
| --- | --- |
| **Integrations** | Connect to external tools (e.g. calendar, Slack/Discord, task apps) so focus state can surface outside the app |
| **Webhook / API** | Machine-readable hooks and API for automation and power-user workflows |
| **Sync later** | When a connected client is offline, queue local activity and reconcile to the backend when connectivity returns |

---

## Post-v1 (considered)

Directions that **may** be explored after Stable (1.0). Inclusion here is **not a guarantee** of delivery, sequencing, or scope.

| Theme | Notes |
| --- | --- |
| **Multi-user — authn and authz** | Built-in identity and access control; isolated settings, sessions, and analytics per user on one deployment |
| **Mobile app (two modes)** | (1) Local-only runtime: timer on device with no persistence and no analytics. (2) Connected: authenticate to a backend and use server-backed sessions, settings, and analytics. Responsive web remains the baseline. |
| **Cloud-hosted paid version** | Managed SaaS offering; depends on multi-user auth and a clear tenancy / billing model |
| **Leaderboard with friends** | Opt-in social comparison among friends; needs identity, relationships, and privacy controls |
| **Adaptive suggestions** | Propose work duration / cycle count (`N`) from personal history |
| **Shared timers** | Optional co-focus / shared session runtime with others |

---

## Phase summary

```text
PRD (alpha)
    │
    ▼
Beta → Stable 1.0
  (hardening + unit test coverage + tags + CSV import/export + backup)
    │
    ├── Post-v1 (likely): integrations · webhook/API · sync later
    │
    └── Post-v1 (considered, not guaranteed):
          multi-user auth · mobile (local | connected) · cloud paid
          · friends leaderboard · adaptive suggestions · shared timers
```

---

## Document history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-07-12 | Alpha = PRD; beta → stable with tags, CSV, backup; post-v1 likely vs considered |
| 1.1 | 2026-07-12 | Beta → 1.0: good unit test coverage as release gate (engine, pause, recovery, API, analytics) |
