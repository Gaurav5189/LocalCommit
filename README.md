# LocalCommit

Local-first CLI for generating conventional commit messages via Ollama.

## The Concept (What It Is & Why It Exists)
**LocalCommit** is a CLI tool that turns `git diff --staged` output into a clean conventional commit message using a local LLM (Gemma 2B via Ollama) or the Backboard API. It asks `[y/N]` to commit directly.

**The "Build for a Friend" Story:** My developer friends writes commits like `wip`, `fix stuff`, `asdf`. Their changelog is useless. Their team broke deployments tracking feature flags. So i built this for them — and for anyone who hates writing conventional commits.

## Setup

```bash
npm install
```

## Scripts

- `npm run build` — Compile TypeScript
- `npm run dev` — Run via ts-node
- `npm run start` — Run compiled binary

## Requirements

- Node.js 18+
- Git CLI
- Ollama server (`ollama serve`) with `gemma2:2b` pre-installed
