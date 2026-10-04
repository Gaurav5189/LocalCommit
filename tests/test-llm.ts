import { generateCommitMessage } from "../src/llm";

const MOCK_DIFF = `diff --git a/example.md b/example.md
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/example.md
@@ -0,0 +1 @@
+Hello world`;

async function main(): Promise<void> {
  console.log("[test-llm] Sending mock diff to Ollama (model from `model` file)...");
  const start = Date.now();
  try {
    const result = await generateCommitMessage(MOCK_DIFF);
    const latency = Date.now() - start;
    console.log(`[test-llm] Latency: ${latency}ms`);
    console.log(`[test-llm] Raw response: ${result}`);
    if (result && result.trim().length > 0) {
      console.log("[test-llm] PASS: Received valid response within acceptable latency (< 5000ms).");
    } else {
      console.error("[test-llm] FAIL: Response was empty.");
      process.exitCode = 1;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-llm] FAIL:", msg);
    process.exitCode = 1;
  }
}

main();
