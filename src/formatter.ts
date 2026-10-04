// Conventional Commit types accepted by the sanitizer.
const VALID_TYPES = new Set([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
]);

// A well-formed Conventional Commit subject: <type>(<scope>): <subject>
const CONVENTIONAL_RE = new RegExp(
  `^(${[...VALID_TYPES].join("|")})(\\([^)]+\\))?!?:\\s+.+$`,
  "i"
);

// Detailed-but-not-wild subject length (git's 50-char soft limit is too tight
// for a useful summary; 100 keeps the line readable in terminals and logs).
const MAX_SUBJECT_LENGTH = 100;
// A scope should be a short module name, never a list of file paths.
const MAX_SCOPE_LENGTH = 24;

// Conjunctions/prepositions that look broken when they end a truncated subject.
const DANGLING_TAIL =
  /\s+(and|or|the|a|an|to|for|of|in|on|at|by|with|update|updates|updating)$/i;

// Irregular/aux verbs -> imperative, applied to the first word of a subject.
const IMPERATIVE_MAP: Record<string, string> = {
  added: "add",
  adds: "add",
  adding: "add",
  updated: "update",
  updates: "update",
  updating: "update",
  fixed: "fix",
  fixes: "fix",
  fixing: "fix",
  removed: "remove",
  removes: "remove",
  removing: "remove",
  changed: "change",
  changes: "change",
  changing: "change",
  created: "create",
  creates: "create",
  creating: "create",
  implemented: "implement",
  implements: "implement",
  implementing: "implement",
  improved: "improve",
  improves: "improve",
  improving: "improve",
  refactored: "refactor",
  refactors: "refactor",
  refactoring: "refactor",
  renamed: "rename",
  renames: "rename",
  documented: "document",
  documents: "document",
  introducing: "introduce",
  introduced: "introduce",
  introduces: "introduce",
  supported: "support",
  supports: "support",
  enabled: "enable",
  enables: "enable",
  allowed: "allow",
  allows: "allow",
  replaced: "replace",
  replaces: "replace",
  simplified: "simplify",
  simplifies: "simplify",
};

/** Force the leading verb of a subject into imperative mood. */
function toImperative(subject: string): string {
  const spaceIndex = subject.indexOf(" ");
  const first = spaceIndex === -1 ? subject : subject.slice(0, spaceIndex);
  const rest = spaceIndex === -1 ? "" : subject.slice(spaceIndex);
  const mapped = IMPERATIVE_MAP[first.toLowerCase()];
  // Only rewrite known non-imperative forms; leave already-imperative words
  // (and their capitalization) untouched.
  if (mapped) return mapped + rest;
  return subject;
}

/**
 * Keep a scope only if it is a single, short module name. File-path lists such
 * as "INSTRUCTION.md, README.md, model, package.json" are rejected, as are
 * generic placeholders, so the model cannot dump the changed-file list into
 * the scope.
 */
const GENERIC_SCOPES = new Set([
  "root",
  "files",
  "file",
  "all",
  "project",
  "changes",
  "change",
  "multiple",
  "various",
  "repo",
  "repository",
  "general",
  "misc",
  "other",
]);

function normalizeScope(rawScope: string | undefined): string {
  if (!rawScope) return "";
  let scope = rawScope.trim();
  if (scope.includes(",") || scope.includes("/") || scope.includes(" ")) return "";
  if (scope.length > MAX_SCOPE_LENGTH) return "";
  scope = scope.replace(/\.(ts|js|json|md|txt|tape|lock)$/i, "");
  if (GENERIC_SCOPES.has(scope.toLowerCase())) return "";
  return scope;
}

/** Infer a Conventional Commit type from free wording. */
function inferType(text: string): string {
  if (/\bfix|\bbug\b|crash|error|regression/i.test(text)) return "fix";
  if (/\bdocs?\b|readme|documentation|instruction/i.test(text)) return "docs";
  if (/\btests?\b|spec/i.test(text)) return "test";
  if (/\bbuild\b|package|dependenc/i.test(text)) return "build";
  if (/\bci\b|workflow|pipeline/i.test(text)) return "ci";
  if (/\bperf\b|performance|speed|optimi/i.test(text)) return "perf";
  if (/\badd|\bimplement|introduc|support|new feature/i.test(text)) return "feat";
  if (/refactor|rewrite|restructure|simplif/i.test(text)) return "refactor";
  return "chore";
}

/** Strip a trailing period and dangling truncation artefacts. */
function cleanSubject(text: string): string {
  let subject = text.trim().replace(/\.+$/, "");
  while (DANGLING_TAIL.test(subject)) {
    subject = subject.replace(DANGLING_TAIL, "").replace(/[,;:]+$/, "").trim();
  }
  return subject;
}

/** Truncate the subject body at a word boundary, preserving the prefix. */
function clampLength(prefix: string, subject: string): string {
  const full = `${prefix}${subject}`.trim();
  if (full.length <= MAX_SUBJECT_LENGTH) return full;
  const maxBody = Math.max(0, MAX_SUBJECT_LENGTH - prefix.length);
  if (subject.length <= maxBody) return full;
  const cut = subject.lastIndexOf(" ", maxBody);
  const body = (cut > 0 ? subject.slice(0, cut) : subject.slice(0, maxBody)).trim();
  return `${prefix}${body}`.trim();
}

/** Fallback subject when the model produced nothing usable. */
const FALLBACK_SUBJECT = "update project files";

/**
 * Parse an arbitrary first line into a valid Conventional Commit message.
 * Accepts valid input as-is; repairs missing/invalid types, file-dump scopes,
 * and empty subjects deterministically.
 */
function toConventionalCommit(message: string): string {
  const line = message.trim();
  const colon = line.indexOf(":");

  let rawType = "";
  let rawScope: string | undefined;
  let rawSubject = line.replace(/^[A-Za-z]+\s*(?:\([^)]*\))?!?:\s*/, "");

  if (colon > 0) {
    const left = line.slice(0, colon).trim();
    const after = line.slice(colon + 1).trim();
    rawSubject = after;
    const typed = left.match(/^([A-Za-z]+)\s*(?:\(([^)]*)\))?!?$/);
    if (typed && VALID_TYPES.has(typed[1].toLowerCase())) {
      rawType = typed[1].toLowerCase();
      rawScope = typed[2];
    } else {
      // No recognized type. Left side may be a scope candidate such as
      // "docs, src, tests" (rejected later if it is really a file list).
      rawType = inferType(`${left} ${after}`);
      rawScope = left;
    }
  } else {
    rawType = inferType(line);
  }

  const type = rawType || inferType(line);
  const scope = normalizeScope(rawScope);
  let subject = cleanSubject(rawSubject);
  if (!subject) subject = FALLBACK_SUBJECT;
  subject = toImperative(subject);
  const prefix = scope ? `${type}(${scope}): ` : `${type}: `;
  return clampLength(prefix, subject);
}

export function sanitizeCommitMessage(rawMessage: string): string {
  // Strip markdown code blocks (with optional language tag)
  let cleaned = rawMessage.replace(/```(?:commit|\w*)?\n?/gi, "");
  cleaned = cleaned.replace(/```/g, "");

  // Strip leading/trailing quotes
  cleaned = cleaned.replace(/^["']+|["']+$/g, "");

  // Ensure single-line compliance (remove embedded newlines, keep first line)
  const firstLine = cleaned.trim().split(/\r?\n/)[0].trim();

  // Remove conversational prefixes / echoed labels.
  let sanitized = firstLine
    .replace(/^(Here is your commit (message|suggestion):\s*)/i, "")
    .replace(/^Commit message:\s*/i, "");

  return toConventionalCommit(sanitized);
}

export { CONVENTIONAL_RE, MAX_SUBJECT_LENGTH };