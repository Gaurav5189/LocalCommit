import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { checkOllamaReachable } from "./ollama-client.js";

function getExpectedModel(): string {
  try {
    const filePath = path.join(__dirname, "..", "model");
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "qwen2.5-coder:3b";
  }
}

function fail(message: string): never {
  console.error(`[env-check] ERROR: ${message}`);
  process.exit(1);
}

function checkGit(): void {
  try {
    execSync("git --version", { stdio: "pipe" });
    console.log("[env-check] Git CLI is installed and accessible.");
  } catch {
    fail("Git CLI is not installed or not accessible. Please install Git and ensure it is in your PATH.");
  }
}

async function checkOllama(): Promise<void> {
  try {
    const baseUrl = await checkOllamaReachable();
    const response = await fetch(new URL("/api/tags", baseUrl).toString(), {
      method: "GET",
    });

    if (!response.ok) {
      fail(`Ollama server at ${baseUrl} responded with status ${response.status}. Ensure 'ollama serve' is running.`);
    }

    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    console.log(`[env-check] Ollama server is running at ${baseUrl}.`);

    const models = data.models || [];
    const modelNames = models.map((m) => m.name || "");

    const expectedModel = getExpectedModel();
    if (modelNames.includes(expectedModel)) {
      console.log(`[env-check] Model '${expectedModel}' is present and ready.`);
    } else {
      console.warn(`[env-check] WARNING: Model '${expectedModel}' not found in Ollama tags. Expected pre-installed locally.`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(`Ollama is not running. Run 'ollama serve' or check your Backboard API key configuration. (${msg})`);
  }
}

async function main(): Promise<void> {
  console.log("[env-check] Starting environment sanity checks...\n");

  checkGit();
  await checkOllama();

  console.log("\n[env-check] All environment checks passed with zero errors.");
}

main();
