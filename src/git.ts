import { execSync } from "child_process";

const MAX_BUFFER = 10 * 1024 * 1024; // 10MB
const MAX_DIFF_BYTES = 32 * 1024; // 32KB
const MAX_DIFF_TOKENS = 8000;

function isInsideGitRepo(): boolean {
  try {
    const result = execSync("git rev-parse --is-inside-work-tree", {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
      maxBuffer: MAX_BUFFER,
    });
    return result.trim() === "true";
  } catch {
    return false;
  }
}

export function getStagedDiff(): string {
  if (!isInsideGitRepo()) {
    throw new Error("Error: Not a git repository.");
  }

  let diff: string;
  try {
    diff = execSync("git diff --staged", {
      encoding: "utf-8",
      maxBuffer: MAX_BUFFER,
    });
  } catch (err: unknown) {
    // Handle binary/non-UTF-8 diffs gracefully by falling back to buffer
    try {
      const buffer = execSync("git diff --staged", {
        encoding: "buffer",
        maxBuffer: MAX_BUFFER,
      }) as Buffer;
      // Try decoding as UTF-8 with lossy replacement for non-UTF-8 chars
      diff = buffer.toString("utf-8");
    } catch (fallbackErr: unknown) {
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`Failed to retrieve staged diff: ${message}`);
    }
  }

  if (diff.trim().length === 0) {
    console.log("No staged changes found. Run 'git add <files>' first.");
    return "";
  }

  // Truncate if exceeds 32KB or ~8000 tokens
  const byteLength = Buffer.byteLength(diff, "utf-8");
  if (byteLength > MAX_DIFF_BYTES || diff.length > MAX_DIFF_TOKENS) {
    diff = diff.slice(0, MAX_DIFF_BYTES) + "\n[Diff truncated due to length]";
  }

  return diff;
}

export function executeCommit(message: string): void {
  if (!isInsideGitRepo()) {
    throw new Error("Error: Not a git repository.");
  }
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    stdio: "inherit",
    maxBuffer: MAX_BUFFER,
  });
}
