# Collaboration Charter

## Mission
Build a privacy-first, deterministic trading application powered by agent-assisted code generation, where human clarity guides agent precision.

## Working Agreement

### Roles & Responsibilities
- **ChatGPT**: Code generation, technical implementation, pattern recognition
- **Ri**: Domain expertise, requirement clarity, acceptance testing, business logic

### Communication Cadence
- **Daily**: Async updates in status board, blocker surfacing
- **Weekly**: Thursday 17:00 Asia/Riyadh → Roadmap review + ticket refinement
- **End-of-milestone**: Release notes + smoke tests

### Principles
1. **One change at a time** → No multitasking across multiple tickets
2. **Test driven** → Acceptance criteria must be testable, implement first
3. **Privacy guard** → No secrets ever committed, no vendor lock-in
4. **Determinism over drama** → Predictable state, no surprises
5. **Agents do code, humans do clarity** → Ri clarifies requirements, ChatGPT implements

### Decision Framework
- **Technical decisions**: ChatGPT proposes with rationale, Ri accepts/tests
- **Business decisions**: Ri provides guidance, ChatGPT asks clarifying questions
- **Blockers**: Escalate immediately with context, resolve same session
- **ADRs**: Document significant architectural decisions in `docs/adr/`

### Team Health
- **Lead time tracking**: Every ticket measured from idea to production
- **Quality metrics**: Zero regression bugs, test coverage maintained
- **Progress transparency**: All work documented in tickets/ with artifacts

### Conflict Resolution
- **Technical disagreements**: Implement both approaches, measure winner
- **Concerns**: Escalate to Ri for final decision
- **Stuck**: 45-minute timebox, escalate if hit

## Tool Chain

### Project Brain (`docs/`)
- **status-board.md** → Live metrics, current session starting point
- **backlog.md** → Prioritized ticket queue
- **roadmap.md** → Milestone planning and objectives
- **north-star.md** → Mission and principles
- **release-notes.md** → Deployment history
- **adr/** → Architecture decision records

### Ticket Format (`tickets/SYS-#-#-description.md`)
- Frontmatter with id, title, goal, acceptance, constraints, tests, artifacts, risk, timebox
- Context, inputs, outputs sections
- DONE WHEN conditions
- All files created/modified listed

### Workflow
1. Start: Always read docs/status-board.md
2. Pull: Promote IDEA→READY tickets based on priorities
3. Work: One ticket at a time, full cycle
4. Document: Create ticket artifact, update status board
5. Review: Weekly cadence for reflection and planning
