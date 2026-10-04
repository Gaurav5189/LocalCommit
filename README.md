# LocalCommit

Local-first CLI for generating conventional commit messages with Ollama.

LocalCommit reads your staged Git diff, generates a Conventional Commit message
with the configured local model, and asks for confirmation before committing.

## Requirements

- Node.js 18+
- Git CLI
- Ollama
- A model configured in the root `model` file (default: `qwen2.5-coder:3b`)

If Ollama is not installed, follow the platform-specific instructions in
[INSTRUCTION.md](INSTRUCTION.md).

## Setup

```bash
npm run setup
```

The setup command verifies Node.js and Git, checks that Ollama is running,
downloads `qwen2.5-coder:3b` if it is missing, installs dependencies, and
builds the project.

If setup reports that Ollama is unavailable, install it and start the Ollama
service by following [INSTRUCTION.md](INSTRUCTION.md).

## Usage

Start Ollama in a separate terminal if it is not already running:

```bash
ollama serve
```

Stage your changes in a Git repository, then run:

```bash
npx localcommit
```

Inside a checkout of this project, `npx localcommit` resolves the local package
binary. To use it from **any** repository on your machine, install or link it
once:

```bash
npm install -g .        # install globally from this checkout
# or
npm link                # symlink the current checkout
```

After that, `npx localcommit` (or just `localcommit`) works from any Git repo
you are inside. The CLI always reads the staged diff of the repository you are
currently in; it does not need to live in that repository.

LocalCommit proposes a commit message and asks `[y/N/e/r]` before creating the
commit:

- `y` — commit with the proposed message
- `n` — abort (nothing is committed)
- `e` — edit the message manually, then commit
- `r` — regenerate: re-run the model with the staged diff and propose again

## How Large Diffs Are Handled

Commit messages are generated in one of two ways depending on diff size:

1. **Single pass** — small diffs (or a single file) are sent directly to the
   model.
2. **Two-stage hierarchical** — large, multi-file diffs are first summarized
   per file, then the summaries are combined into one commit message.

The two-stage path is bounded so it stays responsive on low-end machines:

- The model's real context window is auto-detected (the running value from
  Ollama first, then the architecture value). Override it with
  `LOCALCOMMIT_CONTEXT_WINDOW`.
- Every changed file is always listed with a cheap one-line summary
  (`• path: modified (+n/-m lines)`) plus a compact "changes by area" overview,
  so no changed file is invisible to the model.
- Only the **top 4** files get a one-sentence model summary under a 60-second
  wall-clock budget. Candidates are chosen by area/size (code and newly added
  files first) rather than just the largest files; deterministic heuristics
  fill in for anything not covered.
- When the change set is small enough, all file bodies are sent directly
  instead of being summarized.
- Stage-1 calls run sequentially because a single Ollama instance serializes
  requests anyway.

No hard-coded context window is assumed, so you can bring your own model.

Set `LOCALCOMMIT_DEBUG=1` to print timing, token, and summary diagnostics.

The final message is post-processed deterministically to guarantee format: it
parses `type(scope): subject`, rejects file-list/generic scopes, forces the
subject into imperative mood, and never emits an empty subject.

### Why `/api/chat`

LocalCommit talks to Ollama's native `/api/chat` endpoint. The OpenAI-compatible
`/v1/chat/completions` endpoint ignores `num_predict`, which made replies
verbose and caused timeouts.

## Model Configuration

The default model is read from the root `model` file:

```text
qwen2.5-coder:3b
```

To use another model for one command, set `LOCALCOMMIT_MODEL`:

```bash
LOCALCOMMIT_MODEL=qwen2.5-coder:7b npx localcommit
```

You can also edit the `model` file directly. Make sure the selected model is
installed with Ollama before running LocalCommit.

### Model RAM Guide

| Model | System RAM Requirement |
|---|---|
| `qwen2.5-coder:1.5b` | ~3 GB |
| `qwen2.5-coder:3b` | ~6 GB |
| `qwen2.5-coder:7b` | ~14 GB |
| `qwen2.5-coder:14b` | ~28 GB |

## Development

These commands are optional and are intended for contributors working on the
project itself:

```bash
npm run build   # Compile TypeScript
npm run dev     # Run TypeScript source with ts-node
npm run start   # Run the compiled local CLI
```
