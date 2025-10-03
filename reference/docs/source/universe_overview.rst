Symbol Universe Orchestration
=============================

This note captures the runtime plumbing for the symbol screener → universe
selector → strategy card pipeline that now controls which instruments are
eligible for execution.

Services
--------

``services/universe/service.py`` introduces two asyncio services:

* **ScreenerService** subscribes to the raw tick topic and maintains an
  intraday view of dollar volume, trade counts, and spread telemetry per
  symbol. It emits ``screener.today_top10`` payloads on the cadence described
  in the action plan (5 min → 10:30 ET, 15 min → 12:00 ET, hourly afterwards).
* **UniverseService** listens to those screener payloads plus live broker
  position updates and filters symbols to the ten that may trade. Churn guard
  (15 minutes between swaps) and open-position protection ensure we do not
  thrash allocations when a symbol still has inventory. The service also
  ensures READY-model symbols are prioritised and records the reasons when a
  symbol is sidelined (``NO_READY_MODEL``, ``CHURN_GUARD``, ``OPEN_POSITION``).

Both services persist their latest state to ``sessions/universe-state.json``
so the UI and automation have a shared source of truth even across restarts.

API Surface
-----------

A new Next.js route ``/api/universe`` returns the persisted universe snapshot
and powers the front-end store in ``src/lib/universeStore.ts``. The strategy
card polls this endpoint (30 second cadence) via ``useUniverseData`` and
renders:

* Top 10 dollar-volume list (TodayTop10).
* Active trading symbols with YES/NO badges and textual reasons for any
  exclusion.
* Countdown clocks for the next screener refresh and next churn window.
* Model readiness counters and missing-model warnings to drive nightly jobs.

Algo Integration
----------------

``services/algo/service.py`` now consumes ``universe.active_symbols`` and
maintains an in-memory map of ``symbol → traded?``. Incoming ticks are
ignored if their symbol is not currently allowed, so accidental policy fires
will never touch the broker. When no universe payload has arrived yet we fall
back to the static config list (useful for cold start / tests).

Deferred Work
-------------

* Broker flatten command: The file-based command bridge exists but the
  flatten-all wiring is paused; when the command worker is re-enabled, the
  strategy card button can rely on it.
* Automated tests: we still need targeted churn-guard unit tests and a broker
  command harness that drives the new service loop. Manual smoke scripts live
  under ``scripts/`` during development but should be replaced with pytest
  coverage.
