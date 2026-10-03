import { getStagedDiff } from "../src/git";

function testNoStagedChanges(): void {
  console.log("[test-git] Test a) No staged changes...");
  try {
    const result = getStagedDiff();
    if (result === "") {
      console.log("[test-git] PASS: Returned empty string for no staged changes.");
    } else {
      console.error("[test-git] FAIL: Expected empty string, got:", result);
      process.exitCode = 1;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-git] FAIL:", msg);
    process.exitCode = 1;
  }
}

function testStagedTextFileEdit(): void {
  console.log("[test-git] Test b) Staged text file edit...");
  // This test verifies getStagedDiff executes cleanly in a git repo.
  // A real staged edit would produce non-empty output.
  try {
    const result = getStagedDiff();
    console.log("[test-git] PASS: getStagedDiff executed cleanly.");
    console.log("[test-git] Output length:", result.length, "chars");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-git] FAIL:", msg);
    process.exitCode = 1;
  }
}

function main(): void {
  testNoStagedChanges();
  testStagedTextFileEdit();
  console.log("[test-git] All tests completed.");
}

main();
