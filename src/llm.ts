import { getOllamaHosts } from "./ollama-client.js";

const TIMEOUT_MS = 90 * 1000; // 90s hard cap for a single request
const FINAL_TIMEOUT_MS = 90 * 1000; // 90s for the final commit generation

// Stage-1 knobs. Only the largest few files are summarized with the model;
// every changed file still appears in the final prompt as a cheap one-line
// heuristic. A strict wall-clock budget bounds stage 1 so a run always
// finishes promptly on low-end machines (model prompt-eval is the bottleneck).
const MAX_MODEL_SUMMARIES = 4; // top-N files by diff size
const STAGE1_BUDGET_MS = 60 * 1000; // total wall clock for all model summaries

// Conservative default context window (tokens) if model info unavailable
const DEFAULT_CONTEXT_WINDOW = 4096;
// Reserve tokens for prompt + response + safety margin
const CONTEXT_RESERVE = 1024;
// Max tokens for a single file summary
const MAX_SUMMARY_TOKENS = 150;
// Max tokens for a single file's diff in stage 1 (truncate to this, for speed)
const MAX_FILE_DIFF_TOKENS = 1000;
// Max tokens for the final commit message (kept short on purpose)
const MAX_COMMIT_TOKENS = 60;

function getModel(): string {
  const env = process.env.LOCALCOMMIT_MODEL;
  if (env && env.trim().length > 0) return env.trim();
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "..", "model");
    const content = fs.readFileSync(filePath, "utf-8");
    const model = content.trim();
    if (model) return model;
  } catch {
    // ignore file read errors
  }
  return "qwen2.5-coder:3b";
}

const MODEL = getModel();

function debug(message: string): void {
  if (process.env.LOCALCOMMIT_DEBUG) {
    console.log(`[localcommit:debug] ${message}`);
  }
}

/**
 * Fetch the model's architecture context length from Ollama (`/api/show`).
 * Returns context window in tokens, or null if unavailable.
 */
async function getModelContextWindow(model: string): Promise<number | null> {
  const hosts = getOllamaHosts();
  for (const base of hosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL("/api/show", base).toString();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = (await response.json()) as Record<string, unknown>;

      // Newer Ollama exposes "parameters" as a string with "num_ctx N"
      if (typeof data.parameters === "string") {
        const match = data.parameters.match(/num_ctx\s+(\d+)/);
        if (match) return parseInt(match[1], 10);
      }

      // model_info holds architecture metadata such as "qwen2.context_length"
      const modelInfo = data.model_info as Record<string, unknown> | undefined;
      if (modelInfo) {
        for (const [key, value] of Object.entries(modelInfo)) {
          if (key.endsWith(".context_length") && typeof value === "number" && value > 0) {
            return value;
          }
        }
      }

      // Fallbacks for other Ollama versions
      if (typeof data.num_ctx === "number" && data.num_ctx > 0) {
        return data.num_ctx;
      }
      const params = data.parameters as Record<string, unknown> | undefined;
      if (params && typeof params.num_ctx === "number" && params.num_ctx > 0) {
        return params.num_ctx;
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      // Try next host
    }
  }
  return null;
}

/**
 * Get the context window Ollama has actually allocated for a running model.
 * This can be far smaller than the model's architecture context (e.g. Ollama
 * defaults to 4096 tokens unless the user raises OLLAMA_CONTEXT_LENGTH).
 */
async function getRunningContextWindow(model: string): Promise<number | null> {
  const hosts = getOllamaHosts();
  for (const base of hosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL("/api/ps", base).toString();
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = (await response.json()) as {
        models?: Array<{ name?: string; model?: string; context_length?: number }>;
      };
      const baseName = model.includes(":") ? model : `${model}:latest`;
      const running = (data.models || []).find(
        (m) => m.name === model || m.name === baseName || m.model === model || m.model === baseName
      );
      if (running && typeof running.context_length === "number" && running.context_length > 0) {
        return running.context_length;
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      // Try next host
    }
  }
  return null;
}

/**
 * Get effective context window for the current model.
 * Priority: env override -> running context (/api/ps) -> architecture (/api/show) -> default.
 * Preferring the running context prevents overestimating the window, which is
 * critical on low-end systems where Ollama allocates only 4096 tokens by default.
 */
async function getEffectiveContextWindow(): Promise<number> {
  const envCtx = process.env.LOCALCOMMIT_CONTEXT_WINDOW;
  if (envCtx) {
    const parsed = parseInt(envCtx, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const running = await getRunningContextWindow(MODEL);
  if (running) return running;
  const fromOllama = await getModelContextWindow(MODEL);
  if (fromOllama) return fromOllama;
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * Rough token estimation: ~4 chars per token for code.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to an approximate token budget.
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.max(0, maxTokens * 4);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[Diff truncated due to length]";
}

/**
 * Parse a unified diff into per-file diffs.
 */
function parseDiffByFile(diff: string): Array<{ filePath: string; diff: string }> {
  const result: Array<{ filePath: string; diff: string }> = [];
  const lines = diff.split("\n");
  let currentFile: string | null = null;
  let currentDiffLines: string[] = [];
  let inDiff = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const gitDiffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);

    if (gitDiffMatch) {
      if (currentFile && currentDiffLines.length > 0) {
        result.push({ filePath: currentFile, diff: currentDiffLines.join("\n") });
      }
      currentFile = gitDiffMatch[1];
      currentDiffLines = [line];
      inDiff = true;
    } else if (inDiff) {
      currentDiffLines.push(line);
      if (i === lines.length - 1 && currentFile && currentDiffLines.length > 0) {
        result.push({ filePath: currentFile, diff: currentDiffLines.join("\n") });
      }
    }
  }

  // Filter out binary files (they have no actual diff content)
  return result.filter(({ diff }) => !diff.includes("Binary files") && diff.trim().length > 0);
}

/**
 * Cheap, zero-inference summary derived from diff structure.
 */
function changeKind(fileDiff: string): "new" | "deleted" | "modified" {
  if (/^new file mode/m.test(fileDiff)) return "new";
  if (/^deleted file mode/m.test(fileDiff)) return "deleted";
  return "modified";
}

/**
 * Group changed files into areas (top-level directory or "root") so the model
 * gets a complete, compact view of every file that changed, not just the few
 * it summarized in detail.
 */
function areaKey(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? `${parts[0]}/` : "root";
}

/** Lower rank = shown earlier and preferred as the anchor. Code first. */
function areaRank(key: string): number {
  if (key === "src/") return 0;
  if (key === "tests/") return 2;
  if (key === "root") return 3;
  if (key === "docs/") return 4;
  if (key === "DOCS/") return 4;
  if (key === "demo/") return 5;
  return 1;
}

function buildChangeSummary(
  fileDiffs: Array<{ filePath: string; diff: string }>,
  notes?: Map<string, string>
): string {
  const areas = new Map<string, { files: string[]; kinds: Set<string> }>();
  const deleted: string[] = [];

  for (const { filePath, diff } of fileDiffs) {
    const kind = changeKind(diff);
    if (kind === "deleted") {
      deleted.push(filePath);
      continue;
    }
    const key = areaKey(filePath);
    if (!areas.has(key)) areas.set(key, { files: [], kinds: new Set() });
    const entry = areas.get(key)!;
    entry.files.push(filePath.slice(key === "root" ? 0 : key.length));
    entry.kinds.add(kind);
  }

  const lines: string[] = [];
  // Order code areas before docs/root so the model anchors on implementation.
  const orderedAreas = [...areas.entries()].sort((a, b) => areaRank(a[0]) - areaRank(b[0]));

  for (const [key, { files, kinds }] of orderedAreas) {
    const kindLabel = kinds.has("new") && kinds.has("modified") ? "new+modified" : [...kinds][0];
    const shown = files.slice(0, 8).join(", ");
    const more = files.length > 8 ? ` +${files.length - 8} more` : "";

    // Attach a short intent note from any summarized file in this area.
    let note = "";
    if (notes) {
      for (const f of files) {
        const fullPath = key === "root" ? f : `${key}${f}`;
        const summary = notes.get(fullPath);
        if (summary) {
          const firstBullet = summary
            .split("\n")
            .map((l) => l.replace(/^[-•*]\s*/, "").trim())
            .find((l) => l.length > 0);
          if (firstBullet) {
            note = ` — ${firstBullet.slice(0, 70)}`;
            break;
          }
        }
      }
    }

    lines.push(
      `- ${key} (${files.length} file${files.length > 1 ? "s" : ""}, ${kindLabel}): ${shown}${more}${note}`
    );
  }
  if (deleted.length > 0) {
    lines.push(`- deleted: ${deleted.join(", ")}`);
  }

  return [`Changes by area (${fileDiffs.length} files):`, ...lines].join("\n");
}

/**
 * Pick summary candidates: prefer code areas (src, tests) and newly added
 * files, since those carry the commit's intent, then fill by size.
 */
function selectCandidates(
  fileDiffs: Array<{ filePath: string; diff: string }>,
  max: number
): Array<{ filePath: string; diff: string }> {
  const score = (f: { filePath: string; diff: string }): number => {
    const rank = areaRank(areaKey(f.filePath));
    const isNew = changeKind(f.diff) === "new" ? -1 : 0;
    return rank * 2 + isNew;
  };
  const ranked = [...fileDiffs].sort((a, b) => {
    const s = score(a) - score(b);
    if (s !== 0) return s;
    return b.diff.length - a.diff.length;
  });
  return ranked.slice(0, max);
}

/**
 * Single reusable Ollama chat request.
 * Uses `/api/chat` because the OpenAI-compatible `/v1/chat/completions`
 * endpoint ignores `num_predict`, which makes replies verbose and slow.
 */
async function chat(
  messages: Array<{ role: string; content: string }>,
  opts: { numPredict: number; temperature?: number; timeoutMs: number }
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, opts.timeoutMs));

  const body = JSON.stringify({
    model: MODEL,
    messages,
    stream: false,
    keep_alive: "10m",
    options: {
      temperature: opts.temperature ?? 0.1,
      num_predict: opts.numPredict,
    },
  });

  try {
    // Try each candidate host until one works
    const hosts = getOllamaHosts();
    let lastErr: unknown;
    for (const base of hosts) {
      try {
        const url = new URL("/api/chat", base).toString();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const bodyText = await response.text();
          throw new Error(`Ollama returned status ${response.status}: ${bodyText}`);
        }

        const data = (await response.json()) as { message?: { content?: string } };
        return (data.message?.content || "").trim();
      } catch (err) {
        lastErr = err;
        // If it's a timeout/abort, don't try next host
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Error: Ollama request timed out.");
        }
        // Try next host
      }
    }
    // All hosts failed
    throw lastErr;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Error: Ollama request timed out.");
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Error: Could not connect to Ollama. Ensure 'ollama serve' is running.");
    }
    if (err instanceof Error && /ECONNREFUSED|ECONNRESET|fetch failed/.test(err.message)) {
      throw new Error("Error: Could not connect to Ollama. Ensure 'ollama serve' is running.");
    }
    throw err;
  }
}

/**
 * Stage 1: summarize a single file's diff into concise bullet points.
 */
async function summarizeFileDiff(
  filePath: string,
  fileDiff: string,
  maxFileTokens: number,
  timeoutMs: number
): Promise<string> {
  const diffTokens = estimateTokens(fileDiff);
  let truncatedDiff = fileDiff;
  if (diffTokens > maxFileTokens) {
    truncatedDiff = fileDiff.slice(0, maxFileTokens * 4) + "\n[Diff truncated due to length]";
  }

  const prompt = `Describe what changed in this file in ONE short sentence (max 15 words).
Focus on the purpose of the change, not a list of edits.
No bullets, no numbering, no preamble, no restating the file name.

Diff for ${filePath}:
${truncatedDiff}

Sentence:`;

  const raw = await chat(
    [
      {
        role: "system",
        content:
          "You are a code summarizer. Reply with exactly ONE short sentence (max 15 words) describing the purpose of the change. No bullets, no preamble, no file names.",
      },
      { role: "user", content: prompt },
    ],
    { numPredict: MAX_SUMMARY_TOKENS, temperature: 0.1, timeoutMs }
  );

  // Keep only the first sentence/line.
  return raw.split(/\r?\n/)[0].replace(/^[-•*\d.\s]+/, "").trim();
}

/**
 * Stage 2: generate one Conventional Commit message from the file list and
 * per-file details.
 */
async function generateCommitFromContext(context: string): Promise<string> {
  const prompt = `Write ONE single-line Conventional Commit message for the whole change.

You are given a summary of the change. Write a NEW sentence that captures the
overall intent. Do NOT copy any wording verbatim from the input.

${context}

Rules:
- Format: <type>(<scope>): <subject>
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Pick the type for the PRIMARY work. New features/files -> "feat"; docs-only
  edits -> "docs"; restructuring -> "refactor"; tests -> "test".
- Scope: ONE short module name, max 2 words (llm, formatter, cli, build).
  Never a file name, file list, or the word "root".
- Subject: imperative mood ("Add", "Update", "Fix" - not "Added"), 40-80 chars,
  describing the highest-level outcome, not one file.
- NEVER enumerate file paths or file names.
- No explanations, no markdown, no prefixes, no trailing period.

Commit message:`;

  const raw = await chat(
    [
      {
        role: "system",
        content:
          "You are an expert software engineer. You output exactly ONE line in Conventional Commit format: <type>(<scope>): <subject>. The scope is a single short module name (max 2 words), never a file name or file list. The subject summarizes the intent of the change in imperative mood and is roughly 40-80 characters. You never enumerate file paths. You output only the commit line, with no explanations, markdown, or prefixes.",
      },
      { role: "user", content: prompt },
    ],
    { numPredict: MAX_COMMIT_TOKENS, temperature: 0.1, timeoutMs: FINAL_TIMEOUT_MS }
  );

  return raw;
}

/**
 * Single pass: send the diff directly (small diffs only).
 */
async function singlePassGeneration(diff: string): Promise<string> {
  const prompt = `Generate a single-line Conventional Commit message from this staged diff:

${diff}

Rules:
- Format: <type>(<scope>): <subject>
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Use ONE short scope of at most 2 words (a module name). Never a file name.
- Single line only, roughly 40-80 chars, describing the intent
- Imperative mood ("Add", "Update", "Fix" - not "Added"/"Updated")
- Never enumerate file paths or file names
- No explanations, no markdown, no conversational prefixes, no trailing period

Commit message:`;

  return chat(
    [
      {
        role: "system",
        content:
          "You are an expert software engineer writing a concise but DETAILED single-line commit message in the Conventional Commit format. Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Strict format: <type>(<scope>): <subject>. The subject must be specific and information-rich (roughly 50-100 chars), naming the concrete files, modules, functions, or behaviour changed. Use imperative mood. Do NOT include explanations, markdown, or conversational prefixes. Only output the commit message line.",
      },
      { role: "user", content: prompt },
    ],
    { numPredict: MAX_COMMIT_TOKENS, temperature: 0.1, timeoutMs: TIMEOUT_MS }
  );
}

/**
 * Keep whole summary blocks (never split one mid-way) until the token budget is hit.
 */
function truncateBlocks(blocks: string[], maxTokens: number): string {
  let truncated = "";
  for (const block of blocks) {
    const candidate = truncated + (truncated ? "\n---\n" : "") + block;
    if (estimateTokens(candidate) > maxTokens) break;
    truncated = candidate;
  }
  return truncated;
}

/**
 * Main entry point: two-stage hierarchical generation for large diffs,
 * single-pass for small diffs.
 */
export async function generateCommitMessage(diff: string): Promise<string> {
  if (!diff || diff.trim().length === 0) {
    return "";
  }

  const fileDiffs = parseDiffByFile(diff);
  const totalChars = diff.length;

  // Small diff or single file: send directly.
  if (fileDiffs.length <= 1 || totalChars < 2000) {
    return singlePassGeneration(diff);
  }

  const contextWindow = await getEffectiveContextWindow();
  const availableTokens = contextWindow - CONTEXT_RESERVE;
  const diffTokens = estimateTokens(diff);

  // Fits comfortably -> single pass.
  if (diffTokens < availableTokens * 0.7) {
    return singlePassGeneration(diff);
  }

  // Two-stage approach
  console.log(
    `[localcommit] Large diff detected (${fileDiffs.length} files, ~${diffTokens} tokens, context ~${contextWindow}). Using two-stage summarization...`
  );
  console.log("[localcommit] Summarizing the main code changes first; this can take around a minute.");

  const perFileTokens = Math.max(400, Math.min(MAX_FILE_DIFF_TOKENS, Math.floor(availableTokens * 0.5)));
  const candidates = selectCandidates(fileDiffs, MAX_MODEL_SUMMARIES);
  // If the model set is small, widen it to fill the available context.
  const roomForMore = candidates.length < MAX_MODEL_SUMMARIES && diffTokens < availableTokens * 0.35;

  console.log(
    `[localcommit] Listing ${fileDiffs.length} changed files; summarizing top ${candidates.length} with the model.`
  );
  debug(`context=${contextWindow} available=${availableTokens} perFileTokens=${perFileTokens} buffer=${totalChars} chars`);

  // Small change set -> send all file bodies to the model so the message can
  // reflect every change. Otherwise use per-file summarization.
  if (roomForMore) {
    const changeSummary = buildChangeSummary(fileDiffs);
    const listTokens = estimateTokens(changeSummary);
    const bodyBudget = Math.max(600, Math.floor(availableTokens * 0.75) - listTokens);
    const bodies = fileDiffs
      .map(({ filePath, diff: fileDiff }) => `${filePath}:\n${truncateToTokens(fileDiff, Math.floor(bodyBudget / fileDiffs.length))}`)
      .join("\n---\n");
    const context = [changeSummary, "", "Diffs:", bodies].join("\n");
    return generateCommitFromContext(context);
  }

  // Stage 1: attempt model summaries for the top files, sequentially, under a
  // shared wall-clock budget. Failures and deadline misses silently fall back
  // to the heuristic so a run never stalls or spams errors.
  const detailsByPath = new Map<string, string>();
  const deadline = Date.now() + STAGE1_BUDGET_MS;
  for (const { filePath, diff: fileDiff } of candidates) {
    const remaining = deadline - Date.now();
    if (remaining <= 2000) break;
    debug(`summarizing ${filePath} (~${estimateTokens(fileDiff)} tokens, budget ${Math.round(remaining / 1000)}s)`);
    try {
      const summary = await summarizeFileDiff(filePath, fileDiff, perFileTokens, remaining);
      detailsByPath.set(filePath, summary);
      debug(`summary ${filePath}: ${JSON.stringify(summary.slice(0, 140))}`);
    } catch (err) {
      debug(`summary failed ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Area overview enriched with a short intent note from summarized files.
  const changeSummary = buildChangeSummary(fileDiffs, detailsByPath);
  const listTokens = estimateTokens(changeSummary);

  // Model-derived detail blocks (only for files the model actually covered).
  const detailBlocks = candidates
    .filter((c) => detailsByPath.has(c.filePath))
    .map((c) => `${c.filePath}:\n${detailsByPath.get(c.filePath)}`);

  const context = [
    changeSummary,
    "",
    detailBlocks.length > 0 ? "Detailed notes:" : "",
    detailBlocks.join("\n---\n"),
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  // Keep the final prompt within the model's context if needed.
  const contextTokens = estimateTokens(context);
  if (contextTokens > availableTokens * 0.85 && detailBlocks.length > 0) {
    const budget = Math.max(0, availableTokens * 0.85 - listTokens);
    const trimmedDetails = truncateBlocks(detailBlocks, budget);
    const trimmedContext = [changeSummary, "", trimmedDetails ? "Detailed notes:" : "", trimmedDetails]
      .filter((part) => part.length > 0)
      .join("\n");
    return generateCommitFromContext(trimmedContext);
  }

  return generateCommitFromContext(context);
}