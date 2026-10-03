# Architecture & Design — LocalCommit

## 1. Application Flow Diagram

```
[ Terminal Execution: `npx localcommit` ]
                  │
                  ▼
┌──────────────────────────────────┐
│  src/git.ts: getStagedDiff()    │ ──▶ Executes `git diff --staged`
└──────────────────────────────────┘
                  │
                  ▼ (raw diff string)
┌──────────────────────────────────┐
│  src/llm.ts: generateCommit()    │ ──▶ HTTP POST to Ollama (http://localhost:11434)
└──────────────────────────────────┘     (Fallback: Backboard REST API)
                  │
                  ▼ (raw LLM string)
┌──────────────────────────────────┐
│  src/formatter.ts: cleanOutput() │ ──▶ Sanitizes output (Conventional Commit schema)
└──────────────────────────────────┘
                  │
                  ▼ (clean commit message)
┌──────────────────────────────────┐
│  src/index.ts: User Prompt       │ ──▶ stdin/stdout `[y/N]` prompt
└──────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼ (if 'y')          ▼ (if 'n')
┌───────────────┐   ┌────────────────────────┐
│  `git commit` │   │ Exit without committing│
└───────────────┘   └────────────────────────┘
```

## 2. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Runtime** | Node.js (v18+ LTS) | Native `fetch` support, fast execution, ubiquitous CLI support |
| **Language** | TypeScript (v5+) | Type safety, clear developer tooling, modern JS emission |
| **Shell Access** | Node `child_process` (`execSync`) | Synchronous native shell execution with zero dependencies |
| **Local AI** | Ollama API (`gemma:2b`) | Local-first, privacy-preserving open-weight LLM |
| **Cloud AI Fallback**| Backboard REST API | Secondary inference path for partner submission |
| **CLI I/O** | Node `readline` / `process.stdin` | Zero-dependency interactive terminal prompts |

## 3. Directory & File Structure

```
localcommit/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── RULES.md
│   ├── PHASES.md
│   └── MEMORY.md
├── src/
│   ├── index.ts          # Main CLI orchestration entrypoint
│   ├── git.ts            # Git command wrappers (diff, commit validation)
│   ├── llm.ts            # Ollama & Backboard API client calls
│   └── formatter.ts      # String parsing & conventional commit sanitization
├── bin/
│   └── localcommit.js    # Executable shebang wrapper (`#!/usr/bin/env node`)
├── package.json          # Node dependencies and binary link setup
├── tsconfig.json         # TypeScript compiler configuration
├── README.md             # Developer & user documentation
└── .gitignore            # Git exclusion rules
```