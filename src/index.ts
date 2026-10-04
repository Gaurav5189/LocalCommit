import { getStagedDiff } from "./git";
import { generateCommitMessage } from "./llm";
import { sanitizeCommitMessage } from "./formatter";
import { confirmAndCommit } from "./prompt";

async function main(): Promise<void> {
  try {
    console.log("[localcommit] Checking staged changes...");
    const diff = getStagedDiff();
    if (!diff || diff.trim().length === 0) {
      process.exit(0);
    }

    const fs = require("fs"); const p = require("path"); const modelName = fs.existsSync(p.join(__dirname, "..", "model")) ? fs.readFileSync(p.join(__dirname, "..", "model"), "utf-8").trim() : "qwen2.5-coder:3b";
    console.log(`[localcommit] Sending diff to ${modelName}...`);
    const rawMessage = await generateCommitMessage(diff);
    const cleanMessage = sanitizeCommitMessage(rawMessage);

    if (!cleanMessage || cleanMessage.trim().length === 0) {
      console.error("Error: Received empty commit message from LLM. Aborting.");
      process.exit(1);
    }

    console.log(`[localcommit] Proposed: ${cleanMessage}`);
    const confirmed = await confirmAndCommit(cleanMessage, async () => {
      console.log("[localcommit] Regenerating with fresh diff context...");
      const newRaw = await generateCommitMessage(diff);
      return sanitizeCommitMessage(newRaw);
    });
    if (!confirmed) {
      process.exit(0);
    }
    console.log("Commit completed successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Clean, colorized terminal error without raw stack traces
    console.error(`\n[localcommit] ERROR: ${message}\n`);
    if (message.includes("Not a git repository")) {
      console.error("Make sure you are running inside a git repository.");
    } else if (message.includes("Ollama")) {
      const modelName = require("fs").existsSync(require("path").join(__dirname, "..", "model")) ? require("fs").readFileSync(require("path").join(__dirname, "..", "model"), "utf-8").trim() : "qwen2.5-coder:3b";
      console.error(`Ensure 'ollama serve' is running with '${modelName}' loaded.`);
    }
    process.exit(1);
  }
}

main();
