#!/usr/bin/env node
const { execSync, spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

function getModel() {
  const env = process.env.LOCALCOMMIT_MODEL;
  if (env && env.trim().length > 0) return env.trim();
  try {
    const modelPath = path.join(__dirname, "..", "model");
    const model = fs.readFileSync(modelPath, "utf-8").trim();
    if (model) return model;
  } catch {
    // fall through to default
  }
  return "qwen2.5-coder:3b";
}

function log(msg) {
  console.log(`[localcommit-setup] ${msg}`);
}

function logError(msg) {
  console.error(`[localcommit-setup] ERROR: ${msg}`);
}

function checkNodeAndGit() {
  try {
    execSync("node --version", { stdio: "pipe", encoding: "utf-8" });
    log("Node.js OK.");
  } catch {
    logError("Node.js is not installed or not in PATH.");
    process.exit(1);
  }

  try {
    execSync("git --version", { stdio: "pipe", encoding: "utf-8" });
    log("Git OK.");
  } catch {
    logError("Git CLI is not installed or not in PATH.");
    process.exit(1);
  }
}

function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:11434/api/tags", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const modelNames = (parsed.models || []).map((m) => m.name || "");
          resolve({ online: true, models: modelNames });
        } catch {
          resolve({ online: false, models: [] });
        }
      });
    });
    req.on("error", () => resolve({ online: false, models: [] }));
    req.setTimeout(3000, () => {
      req.abort();
      resolve({ online: false, models: [] });
    });
  });
}

function streamDownload(model) {
  return new Promise((resolve, reject) => {
    log(`Pulling ${model} from Ollama registry...`);
    const child = spawn("ollama", ["pull", model], {
      stdio: ["inherit", "pipe", "inherit"],
    });
    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    child.on("close", (code) => {
      if (code === 0) {
        log("✓ Model downloaded successfully.");
        resolve();
      } else {
        reject(new Error(`ollama pull exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const model = getModel();
  log("Starting LocalCommit setup...");
  log(`Configured model: ${model}`);
  checkNodeAndGit();

  const ollamaStatus = await checkOllama();
  if (!ollamaStatus.online) {
    logError("Ollama service is not running. Please start Ollama first.");
    process.exit(1);
  }
  log("Ollama server is running.");

  // Match exact tag, or exact base with implicit :latest when no tag given.
  const installed =
    ollamaStatus.models.includes(model) ||
    (!model.includes(":") && ollamaStatus.models.includes(`${model}:latest`));

  if (!installed) {
    try {
      await streamDownload(model);
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  } else {
    log(`${model} already installed.`);
  }

  log("Installing dependencies...");
  execSync("npm install", { stdio: "inherit" });

  log("Building TypeScript...");
  execSync("npm run build", { stdio: "inherit" });

  log("✓ LocalCommit setup complete! Run 'npx localcommit' to test.");
}

main();
