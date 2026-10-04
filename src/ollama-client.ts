/**
 * Ollama host resolution utilities.
 * Handles container/host differences where `localhost` may resolve to ::1
 * while Ollama binds to 127.0.0.1, and respects OLLAMA_HOST env var.
 */

/** Returns the list of candidate Ollama base URLs to try, in order. */
export function getOllamaHosts(): string[] {
  const hosts: string[] = [];
  if (process.env.OLLAMA_HOST) {
    // User explicitly configured; try this first.
    hosts.push(process.env.OLLAMA_HOST.replace(/\/$/, ""));
  }
  // Common defaults
  hosts.push("http://localhost:11434");
  hosts.push("http://127.0.0.1:11434");
  return hosts;
}

/**
 * Attempts a fetch against each candidate Ollama host until one succeeds.
 * Returns the successful response and the URL that worked.
 * Throws the last error if all fail.
 */
export async function ollamaFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; url: string }> {
  const hosts = getOllamaHosts();
  let lastErr: unknown;

  for (const base of hosts) {
    try {
      const url = new URL(path, base).toString();
      const response = await fetch(url, init);
      const data = (await response.json()) as T;
      return { data, url };
    } catch (err) {
      lastErr = err;
      // Try next host
    }
  }
  throw lastErr;
}

/** Checks if Ollama is reachable; returns the working base URL or throws. */
export async function checkOllamaReachable(): Promise<string> {
  const hosts = getOllamaHosts();
  for (const base of hosts) {
    try {
      const url = new URL("/api/tags", base).toString();
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return base;
      }
    } catch {
      // Try next
    }
  }
  throw new Error(
    "Could not connect to Ollama. Ensure 'ollama serve' is running. " +
      "Tried: " + hosts.join(", ")
  );
}