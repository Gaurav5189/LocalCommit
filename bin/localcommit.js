#!/usr/bin/env node

// Executable CLI entry point for localcommit
// During development: points to ts-node invocation; compiled: points to dist/index.js

const { spawnSync } = require("child_process");
const path = require("path");

// Prefer compiled output if available; fall back to ts-node dev invocation
const compiledPath = path.join(__dirname, "..", "dist", "index.js");
const tsNodePath = path.join(__dirname, "..", "src", "index.ts");

try {
  require.resolve(compiledPath);
  require(compiledPath);
} catch {
  // Development fallback: invoke via ts-node
  const result = spawnSync("npx", ["ts-node", tsNodePath, ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: false,
  });
  process.exit(result.status ?? 0);
}
