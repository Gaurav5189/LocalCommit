# Development Phases — LocalCommit

## Phase 1: Environment & Project Setup
- [x] Initialize Node.js TypeScript project (`package.json`, `tsconfig.json`).
- [x] Configure executable binary field (`bin/localcommit.js`).
- [x] Verify script invocation via `npx ts-node src/index.ts`.
- [x] Create initial documentation structure in `docs/`.
- [x] Create environment check utility (`src/env-check.ts`).
- [x] Verify `git` CLI accessibility and model (`model` file) readiness.

## Phase 2: Git Integration Engine (`src/git.ts`)
- [x] Implement `getStagedDiff()` using `child_process.execSync`.
- [x] Handle buffer size limits for large diffs (`maxBuffer: 10 * 1024 * 1024`).
- [x] Implement `executeCommit(message: string)` wrapper. (Not required for Phase 2; deferred to Phase 4 wiring)
- [x] Add guard check for empty staged diffs.
- [x] Add binary/non-UTF-8 graceful handling.
- [x] Integration test `tests/test-git.ts` created.

## Phase 3: AI Inference Client (`src/llm.ts`)
- [x] Implement `generateCommitMessage(diff: string)` using native `fetch`.
- [x] Build structured system prompt enforcing Conventional Commit format (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`).
- [x] POST to `http://localhost:11434/v1/chat/completions` using model from `model` file.
- [x] Handle `ECONNREFUSED` with user-friendly error: `"Error: Could not connect to Ollama..."`.
- [x] Implement 15-second HTTP timeout (`AbortController`) with `"Error: Ollama request timed out."`.
- [x] Integration test `tests/test-llm.ts` created; verified clean inference (`feat(example): Add hello world to example.md`).
- [ ] Implement `generateCommitBackboard(diff: string)` for fallback. (Deferred to Phase 4/5)

## Phase 4: Output Sanitization & Interactivity (`src/formatter.ts` & `src/index.ts`)
- [x] Build `sanitizeCommitMessage()` stripping markdown wrappers and conversational prefixes (`formatter.ts`).
- [x] Implement `confirmAndCommit()` interactive `readline` prompt with `[y/N/e]` handling (`prompt.ts`).
- [x] Wire full pipeline: Diff → LLM → Formatter → Prompt → Commit (`index.ts`).
- [x] Never execute `git commit` without explicit `y` confirmation.

## Phase 5: Packaging & Testing
- [x] Compile TypeScript to JavaScript (`npm run build`) verified.
- [x] End-to-end flow verified: `node bin/localcommit.js` executes full pipeline (`feat(demo): add feature test` committed on `y`).
- [x] Error recovery verified: empty diff exits cleanly; no raw stack traces leak.
- [x] `README.md` updated with quickstart, prerequisites (`model` file), and partner tags (`#gemma`, `#backboard`).
- [x] `demo/demo.tape` (vhs script) created for 15-second recording.
- [x] `bin/localcommit.js` packaging verified (compiled/dist fallback + ts-node dev fallback).

### Phase 5.1: Accuracy & Large-Diff Handling
- [x] Removed hard-coded 1500-char diff truncation in the LLM layer.
- [x] Runtime context-window detection: `LOCALCOMMIT_CONTEXT_WINDOW` -> running value (`/api/ps`) -> architecture (`/api/show`) -> 4096 default. No hard-coded window; bring-your-own-model supported.
- [x] Removed the 32KB diff truncation in `src/git.ts` (it was silently hiding files from the model and causing under-reported messages).
- [x] Two-stage hierarchical generation for large multi-file diffs: all changed files listed (heuristic + changes-by-area), top-4 diverse-area model summaries (capped ~1000 tokens each), 60s stage-1 budget, silent heuristic fallback; all-bodies path when the set is small.
- [x] Formatter rewritten to deterministically parse/repair `type(scope): subject`: rejects file-list/generic scopes, forces imperative mood, infers type, recovers empty subject.
- [x] Removed prompt examples that small models parrot; stage-1 now produces one short sentence per file; candidate selection prefers code/new files.
- [x] `LOCALCOMMIT_DEBUG=1` diagnostics for timing/tokens/summaries.
- [x] Detailed-subject prompts (50-100 chars) and formatter that preserves detail, strips echoed labels/trailing periods, and truncates at word boundaries with dangling-word cleanup.
- [x] `tests/test-formatter.ts` expanded (detail preserved, trailing period, word-boundary truncation, echoed label, dangling tail).
- [x] Switched inference from OpenAI-compatible `/v1/chat/completions` (ignores `num_predict`) to native Ollama `/api/chat`; timeouts and verbose output fixed.
- [x] Prompt hardened against buffered terminal escape sequences (`^[[D`/`^[[C`) and stray input; no spurious aborts.
- [x] `scripts/setup.js` reads the configured model from the `model` file / `LOCALCOMMIT_MODEL`.
- [x] Verified `npm pack` includes `model` + `dist` and the packed binary runs correctly from inside a different git repository.

## Phase 6: Submission Assets & DEV Post Documentation
- [ ] Record 15-second terminal demo using `vhs` or screen recorder.
- [ ] Create header graphic (1200x600px).
- [ ] Draft DEV.to submission post highlighting `#gemma`, `#backboard`, and the local-first architecture.