# Project Memory — Single Source of Truth

This folder is the **permanent, self-contained knowledge base** for the LILA BLACK
Player Journey Visualization Tool. It is designed so that **any developer or AI
assistant** (Claude, ChatGPT, Cursor, GitHub Copilot, or a human) can open *only
this repository* and immediately understand what the project is, what is done,
what remains, and why decisions were made — **without any prior chat history**.

> ⚠️ Do not rely on external/tool-specific "memory" (e.g. Claude Code project
> memory, ChatGPT memory). Those are not portable across tools or across the two
> workspace folders. **These files are the authoritative record.** If they ever
> disagree with an AI's private memory, these files win.

## Files

| File | Purpose |
|---|---|
| [PROJECT_STATE.md](PROJECT_STATE.md) | Snapshot of *right now*: completion %, milestones, architecture, tech stack, contract, deployment, limitations, priorities. |
| [WORKFLOW.md](WORKFLOW.md) | The complete development workflow (lifecycle, ETL, frontend, build, test, deploy, docs) and how to continue. |
| [AI_CONTEXT.md](AI_CONTEXT.md) | Full onboarding context for a future AI assistant that has never seen this project. Read this first. |
| [ROADMAP.md](ROADMAP.md) | Remaining work as milestones with objective, files, dependencies, effort, acceptance criteria, priority. |
| [CHANGELOG.md](CHANGELOG.md) | Human-readable log of significant architectural/structural changes. |
| [DECISIONS.md](DECISIONS.md) | Engineering decision records: problem, alternatives, decision, reason, trade-offs, implications. |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Open bugs, technical debt, performance opportunities, potential refactors, future enhancements. |

## Maintenance rule (workflow continuity)

**Whenever a milestone is completed, update — in the same change:**
`PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `DECISIONS.md`.

This keeps the repository always reflecting the true current state. See the
"Documentation workflow" section of [WORKFLOW.md](WORKFLOW.md) for the exact procedure.

## Related repository docs (not duplicated here)

- [../../etl/ETL_FLOW.md](../../etl/ETL_FLOW.md) — per-module ETL I/O & transforms.
- [../../etl/ETL_VERIFICATION.md](../../etl/ETL_VERIFICATION.md) — dataset stats, reconciliation, the 10-point audit.
- [../../PROJECT_SUMMARY.md](../../PROJECT_SUMMARY.md) — narrative build log (historical; this folder supersedes it as the living record).

_Last updated: 2026-07-03._
