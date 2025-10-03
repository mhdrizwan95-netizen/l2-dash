---
id: SYS-01
title: Bootstrap Project Brain (initial docs/)
goal: Create the shared project brain so ChatGPT and Ri always stay in sync
acceptance:
  - A `docs/` folder exists in repo
  - Contains: status-board.md, backlog.md, roadmap.md, north-star.md, release-notes.md
  - Each file seeded with the provided initial content
  - ADR folder `docs/adr/` exists (empty for now)
  - README has a short "Project Brain" section linking to docs/
constraints:
  - Docs only, no code changes
tests:
  - Repo builds/runs unchanged
  - `git status` shows only new docs files
artifacts:
  - File tree of `docs/` folder
  - Screenshot of README links
risk:
  - None (documentation only)
timebox: 45m
---

## CONTEXT
This is the very first step of our collaboration system. These docs act as the single source of truth for roadmap, backlog, status, and decisions. Every future session will begin from `docs/status-board.md`.

## INPUTS
- Templates for each file (below)

## OUTPUTS
- `docs/` folder populated with initial files
- README updated with links

---

## FILES TO CREATE

### docs/status-board.md
# Status Board (Live)

Last update: 2025-10-03 17:00 Asia/Riyadh
North Star: Build a privacy-first, deterministic trading app powered by agents.
Current Objective: Milestone M1 – Stable cockpit UI with no black-screen issues
Milestone: M1 (Target: 2025-10-31)
Focus (Top 3 Ready tickets): none yet (to be promoted from backlog)
Blocked: none
Next Release: 2025-10-31 | Owner: Ri

Flow (last 7 days)
- Done: 0
- Mean Lead Time: n/a
- Escaped Defects: 0

Cadence:
- Daily (async): Update backlog states + blockers
- Weekly (Thu 17:00 Asia/Riyadh): Review roadmap + pick next Ready tickets
- End of milestone: Cut release notes + run smoke checklist

Metrics (last 7 days):
- Lead time (Idea→Done): n/a
- Flow efficiency: n/a
- Hit rate: n/a
- Escaped defects: 0

---

### docs/backlog.md
# Backlog (Top→Bottom = priority)

[IDEA] Fix black-screen bug when cockpit loads with invalid panel sizes
[IDEA] Ensure layout persistence clamps panel dimensions
[IDEA] Add Run Brief / Debug Brief reporting requirement to tickets
[IDEA] Automate heartbeat timestamp with local script

[READY] (none yet)
[IN-PROGRESS] (none yet)
[REVIEW] (none yet)
[DONE] (none yet)

---

### docs/roadmap.md
# Roadmap (Q4 2025)

Objective: Have a working cockpit UI that loads cleanly and supports safe panel resizing.

Milestone M1: Cockpit stability (Target: 2025-10-31)
- Black screen bug fixed (layout always visible)
- Layout persistence clamps invalid states
- Agent reporting standardized (Run/Debug Briefs)
- Status-board heartbeat script working

Change Log:
- 2025-10-03: Created initial milestone and backlog seeds

---

### docs/north-star.md
# North Star

Mission: Build a trading application that is privacy-first, deterministic, and agent-assisted.

Principles:
- Determinism over drama: predictable state, no surprises
- Privacy guard: no secrets ever committed
- Agents do code, humans do clarity
- One change at a time, traceable

Non-Goals:
- No vendor lock-in
- No "just works" magic without traceability

Core Loop:
Data ingest → Signal generation → Risk checks → Orders → Audit → Review

KPIs:
- Mean lead time per ticket
- Stability (0 black-screen defects)
- Test coverage on core loops

Review cadence: Weekly (Thu 17:00 Asia/Riyadh)

---

### docs/release-notes.md
# Release Notes

No releases yet. First milestone target: 2025-10-31 (Cockpit stability).

---

### docs/adr/
(empty folder created)

---

### README (append section)
## Project Brain (docs/)
- Live status → [docs/status-board.md](docs/status-board.md)
- Backlog → [docs/backlog.md](docs/backlog.md)
- Roadmap → [docs/roadmap.md](docs/roadmap.md)
- Decisions → [docs/adr/](docs/adr/)
- Releases → [docs/release-notes.md](docs/release-notes.md)

---

## DONE WHEN
- All listed files/folders exist with the initial content above
- README links work
- Repo builds/runs as before
