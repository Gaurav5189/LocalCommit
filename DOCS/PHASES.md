# Development Phases — LocalCommit

## Phase 1: Environment & Project Setup
- [x] Initialize Node.js TypeScript project (`package.json`, `tsconfig.json`).
- [x] Configure executable binary field (`bin/localcommit.js`).
- [x] Verify script invocation via `npx ts-node src/index.ts`.
- [x] Create initial documentation structure in `docs/`.
- [x] Create environment check utility (`src/env-check.ts`).
- [x] Verify `git` CLI accessibility and `gemma2:2b` readiness (Ollama server offline, error handled cleanly).

## Phase 2: Git Integration Engine (`src/git.ts`)
- [x] Implement `getStagedDiff()` using `child_process.execSync`.
- [x] Handle buffer size limits for large diffs (`maxBuffer: 10 * 1024 * 1024`).
- [x] Implement `executeCommit(message: string)` wrapper. (Not required for Phase 2; deferred to Phase 4 wiring)
- [x] Add guard check for empty staged diffs.
- [x] Add binary/non-UTF-8 graceful handling.
- [x] Integration test `tests/test-git.ts` created.

## Phase 3: AI Inference Client (`src/llm.ts`)
- [ ] Implement `generateCommitOllama(diff: string)` calling `http://localhost:11434/api/generate`.
- [ ] Implement strict system prompt forcing Conventional Commit format (`feat`, `fix`, `chore`, `docs`, `refactor`).
- [ ] Implement `generateCommitBackboard(diff: string)` for fallback.
- [ ] Add connection timeout and offline error handling.

## Phase 4: Output Sanitization & Interactivity (`src/formatter.ts` & `src/index.ts`)
- [ ] Build string parser to strip markdown block wrappers (```) and conversational prefixes.
- [ ] Implement terminal interactive readline interface for `[y/N]` user prompt.
- [ ] Wire up main flow: Diff → LLM → Formatter → Prompt → Exec Commit.

## Phase 5: Packaging & Testing
- [ ] Compile TypeScript to JavaScript (`npm run build`).
- [ ] Test end-to-end flow on sample git repositories.
- [ ] Test error recovery (Ollama down, empty diff, abort action).

## Phase 6: Submission Assets & DEV Post Documentation
- [ ] Record 15-second terminal demo using `vhs` or screen recorder.
- [ ] Create header graphic (1200x600px).
- [ ] Draft DEV.to submission post highlighting `#gemma`, `#backboard`, and the local-first architecture.