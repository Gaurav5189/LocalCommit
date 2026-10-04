# Instruction — Model Management

The source of truth for the active model is the `model` file in the project root (`qwen2.5-coder:3b` by default). The CLI (`src/llm.ts`) reads this file at runtime, falling back to the `LOCALCOMMIT_MODEL` environment variable if set.

## Ollama Commands

### List installed models
```
ollama list
```

### View active running models in RAM
```
ollama ps
```

### Uninstall old models to free disk space
Read the current model name from the `model` file and remove it:
```bash
ollama rm $(cat model)
```

## Changing the Active Model

Edit the `model` file:
```bash
echo "qwen2.5-coder:7b" > model
```

Or set the environment variable before running:
```bash
LOCALCOMMIT_MODEL=qwen2.5-coder:7b npx localcommit
```

## Interactive Prompt Options
When committing interactively, the prompt supports:
- `y` — commit with the proposed message
- `n` — abort
- `e` — edit the message manually
- `r` — regenerate (re-runs the LLM with the staged diff)

## Context Window & Large Diffs

LocalCommit does not hard-code a context window. At runtime it detects the
active model's window in this order:

1. `LOCALCOMMIT_CONTEXT_WINDOW` environment variable (if set).
2. The running value reported by Ollama (`/api/ps`, e.g. `context_length`).
3. The model architecture value from Ollama (`/api/show`, e.g.
   `qwen2.context_length`).
4. A conservative default (4096).

The running value matters: a model may advertise a 32k architecture window
while Ollama actually allocates only 4096 tokens unless `OLLAMA_CONTEXT_LENGTH`
is raised. Preferring the running value prevents overestimating the window.

For large, multi-file diffs, LocalCommit uses a two-stage approach:
- **Stage 1** — each of the top 4 files (code and newly added files first) is
  summarized into one short sentence, under a 60-second wall-clock budget.
  Everything not covered by the model falls back to a deterministic heuristic.
  If the change set is small enough, all file bodies are sent directly.
- **Stage 2** — synthesize the summaries into one Conventional Commit message.

The final message is then post-processed deterministically: it parses
`type(scope): subject`, rejects file-list/generic scopes, forces imperative
mood, and never emits an empty subject.

Environment variables:
- `LOCALCOMMIT_MODEL` — override the model for one run.
- `LOCALCOMMIT_CONTEXT_WINDOW` — override the detected context window.
- `LOCALCOMMIT_DEBUG=1` — print timing/token/summary diagnostics.

## Why the native `/api/chat` endpoint

LocalCommit uses Ollama's native `/api/chat`. The OpenAI-compatible
`/v1/chat/completions` endpoint ignores `num_predict`, producing verbose output
and causing timeouts.
