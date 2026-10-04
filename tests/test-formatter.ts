import { sanitizeCommitMessage } from "../src/formatter";

function testCleanMessage(): void {
  const clean = "feat(auth): add login";
  const result = sanitizeCommitMessage(clean);
  console.assert(result === clean, `[formatter] FAIL: expected '${clean}', got '${result}'`);
  console.log("[formatter] PASS: Clean message preserved.");
}

function testMarkdownStrip(): void {
  const dirty = "```\nfeat(ui): update button\n```";
  const result = sanitizeCommitMessage(dirty);
  console.assert(result === "feat(ui): update button", `[formatter] FAIL: expected 'feat(ui): update button', got '${result}'`);
  console.log("[formatter] PASS: Markdown stripped.");
}

function testConversationalPrefix(): void {
  const dirty = "Here is your commit message: fix(bug): resolve crash";
  const result = sanitizeCommitMessage(dirty);
  console.assert(result === "fix(bug): resolve crash", `[formatter] FAIL: expected 'fix(bug): resolve crash', got '${result}'`);
  console.log("[formatter] PASS: Conversational prefix removed.");
}

function testPreservesDetail(): void {
  const detailed =
    "refactor(prompt): add regenerate option that re-runs the LLM with the staged diff";
  const result = sanitizeCommitMessage(detailed);
  console.assert(result === detailed, `[formatter] FAIL: expected detail preserved, got '${result}'`);
  console.log("[formatter] PASS: Detailed subject preserved.");
}

function testStripsTrailingPeriod(): void {
  const dirty = "docs(readme): update quickstart instructions.";
  const result = sanitizeCommitMessage(dirty);
  console.assert(result === "docs(readme): update quickstart instructions", `[formatter] FAIL: expected trailing period stripped, got '${result}'`);
  console.log("[formatter] PASS: Trailing period stripped.");
}

function testTruncatesAtWordBoundary(): void {
  const long = "feat(parser): " + "add ".repeat(40).trim();
  const result = sanitizeCommitMessage(long);
  console.assert(result.startsWith("feat(parser): add"), `[formatter] FAIL: prefix lost, got '${result}'`);
  console.assert(result.length <= 100, `[formatter] FAIL: not truncated, length ${result.length}`);
  console.assert(!result.endsWith(" "), `[formatter] FAIL: trailing space, got '${result}'`);
  console.log("[formatter] PASS: Long subject truncated at word boundary.");
}

function testEchoedLabelRemoved(): void {
  const dirty = "Commit message: feat(cli): add setup command";
  const result = sanitizeCommitMessage(dirty);
  console.assert(result === "feat(cli): add setup command", `[formatter] FAIL: expected label removed, got '${result}'`);
  console.log("[formatter] PASS: Echoed 'Commit message:' label removed.");
}

function testThrowsOnDanglingTail(): void {
  const dirty =
    "fix(INSTRUCTION.md): add Windows, macOS, and Linux installation instructions for Ollama, update";
  const result = sanitizeCommitMessage(dirty);
  console.assert(!/\bupdate$/i.test(result), `[formatter] FAIL: dangling tail kept, got '${result}'`);
  console.assert(/^fix\(INSTRUCTION\): add Windows/.test(result), `[formatter] FAIL: prefix lost, got '${result}'`);
  console.log("[formatter] PASS: Dangling trailing word removed.");
}

function testRepairsFileDumpScope(): void {
  const dirty = "docs, src, tests: Add new features and refactor for Conventional Commit format";
  const result = sanitizeCommitMessage(dirty);
  console.assert(
    /^[a-z]+: .+/.test(result),
    `[formatter] FAIL: file-list scope not rejected, got '${result}'`
  );
  console.assert(!result.includes(","), `[formatter] FAIL: file list leaked into scope, got '${result}'`);
  console.log("[formatter] PASS: File-list scope rejected and type inferred.");
}

function testRecoversEmptySubject(): void {
  const dirty =
    "docs(INSTRUCTION.md, README.md, model, package.json, src/llm.ts):";
  const result = sanitizeCommitMessage(dirty);
  console.assert(/^docs: .+/.test(result), `[formatter] FAIL: empty subject not recovered, got '${result}'`);
  console.assert(!/\([^)]*,[^)]*\)/.test(result), `[formatter] FAIL: file list kept in scope, got '${result}'`);
  console.log("[formatter] PASS: Empty subject recovered without a file-list scope.");
}

function testInfersTypeWithNoPrefix(): void {
  const result = sanitizeCommitMessage("Fix crash when staging binary files");
  console.assert(result.startsWith("fix: "), `[formatter] FAIL: type not inferred, got '${result}'`);
  console.log("[formatter] PASS: Type inferred when no prefix present.");
}

function testKeepsValidPrefix(): void {
  const clean = "feat(cli): add setup command";
  console.assert(sanitizeCommitMessage(clean) === clean, "[formatter] FAIL: valid prefix changed");
  console.log("[formatter] PASS: Valid prefix untouched.");
}

function main(): void {
  testCleanMessage();
  testMarkdownStrip();
  testConversationalPrefix();
  testPreservesDetail();
  testStripsTrailingPeriod();
  testTruncatesAtWordBoundary();
  testEchoedLabelRemoved();
  testThrowsOnDanglingTail();
  testRepairsFileDumpScope();
  testRecoversEmptySubject();
  testInfersTypeWithNoPrefix();
  testKeepsValidPrefix();
  console.log("[formatter] All tests completed.");
}

main();
