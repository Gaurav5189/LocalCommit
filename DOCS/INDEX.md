# Project Index & Map

# Context Retrieval Rules
- Do NOT read full doc files (prd.md, architecture.md, design.md, rules.md, phases.md, memory.md) at session start.
- Retrieve documentation ONLY on demand using targeted file reads or `grep` search when required by the active task.
- ALWAYS respect `RULES.md` code conventions when writing code. If writing new code, read `RULES.md` first.

## Active State
- **Current Phase:** [Phase 5 complete — RELEASE READY] + Setup Script & BIS docs added
- **Current Task:** Cross-platform setup, package script, README BIS chart, and Ollama instructions in the root `INSTRUCTION.md`.

## Doc Map
- **`RULES.md`**: Code formatting, framework rules, strict constraints. (path: DOCS/)
- **`PRD.md`**: Product features, user flows, acceptance criteria. (DOCS/)
- **`ARCHITECTURE.md`**: Database schema, API endpoints, folder structure, system flow. (DOCS/)
- **`PHASES.md`**: Roadmap breakdown, current phase deliverables, completed milestones. (DOCS/)
- **`MEMORY.md`**: Architectural decisions, past bugs, lessons learned. (.agents/)

## Retrieval Guidelines
1. Modifying DB/API/Endpoints? -> Read relevant sections in `ARCHITECTURE.md`.
2. Updating roadmap or status? -> Check `PHASES.md`.
3. Stuck on an edge-case bug? -> Grep `MEMORY.md` for related issues.
