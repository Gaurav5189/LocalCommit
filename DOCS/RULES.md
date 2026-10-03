# Development Rules & Guardrails — LocalCommit

## 1. Permitted Libraries & Tools
- **Approved Built-ins:** `child_process`, `readline`, `path`, `fs`, `util`, `process`.
- **Approved External Libraries:**
  - `typescript` & `ts-node` (Dev dependencies only).
  - Native `fetch` (Global in Node 18+).
  - Light CLI utility libraries if absolutely necessary (e.g., `picocolors` or `commander`), but built-ins are strongly preferred to maintain zero dependency weight.

## 2. Strictly Unapproved Practices
- ❌ **No Heavy Frameworks:** Do NOT introduce Express, React, Ink, or heavy UI frameworks.
- ❌ **No External AI SDKs:** Do NOT install massive SDKs like `@langchain/core` or `openai` package unless strictly required. Use clean native `fetch` calls to REST endpoints.
- ❌ **No Remote Code Execution:** Never execute unchecked shell commands constructed directly from unparsed remote strings.

## 3. Error Handling Guidelines
1. **No Staged Files:** Catch empty diff outputs before invoking LLM calls. Output friendly notice: `"No staged changes found. Use 'git add <file>' first."`
2. **Ollama Unavailable:** If `http://localhost:11434` returns `ECONNREFUSED`, output clear instructions: `"Ollama is not running. Run 'ollama serve' or check your Backboard API key configuration."`
3. **Invalid AI Response:** If the LLM generates conversational text (e.g., *"Here is your commit message: feat: add user auth"*), sanitize it in `formatter.ts` before showing it to the user.

## 4. AI Boundaries & Safety Constraints
- **Scope Limit:** The AI agent must NOT create destructive git wrappers (e.g., `git reset --hard`, `git push --force`, `git rebase`).
- **Prompt Isolation:** System prompt MUST mandate concise, single-line output matching Conventional Commits rules.
- **Explicit Confirmation:** The CLI MUST NEVER auto-commit without explicit manual `y` input from the user.