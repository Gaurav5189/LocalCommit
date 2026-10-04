import { execSync } from "child_process";
import * as readline from "readline";

// Matches ANSI/CSI escape sequences and stray control characters that a
// terminal may leave in the input buffer (e.g. arrow keys: ^[[D, ^[[C).
const ANSI_OR_CONTROL = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001B|[\u0000-\u001F\u007F]/g;

/**
 * Remove terminal escape/control noise. Arrow keys and the like arrive as
 * escape sequences that would otherwise be mistaken for a real answer.
 */
function stripControlChars(input: string): string {
  return input.replace(ANSI_OR_CONTROL, "").trim();
}

/**
 * Discard any bytes already buffered on stdin (e.g. keystrokes the user made
 * while the model was generating) so they are not consumed as the answer.
 */
function drainStdin(): void {
  if (!process.stdin.isTTY) return;
  try {
    // Non-blocking: returns null when nothing is buffered.
    while (process.stdin.read() !== null) {
      // discard
    }
  } catch {
    // ignore
  }
}

function runCommit(message: string): boolean {
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
    return true;
  } catch (err: unknown) {
    console.error("Failed to execute commit.", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export function confirmAndCommit(message: string, onRegenerate?: () => Promise<string>): Promise<boolean> {
  return new Promise((resolve) => {
    const ask = (currentMessage: string): void => {
      drainStdin();
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log("\nProposed commit message:");
      console.log(`  ${currentMessage}\n`);

      rl.question("Commit with this message? [y/N/e (edit)/r (regenerate)]: ", (answer: string) => {
        rl.close();
        const raw = answer;
        const input = stripControlChars(answer).toLowerCase();

        // If the answer was nothing but escape/control noise, ask again rather
        // than treating it as an abort.
        if (input.length === 0 && raw.trim().length > 0) {
          console.log("(Ignored stray input; please type y, n, e, or r.)");
          ask(currentMessage);
          return;
        }

        if (input === "y" || input === "yes") {
          resolve(runCommit(currentMessage));
        } else if (input === "e" || input === "edit") {
          const editRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          editRl.question("Enter override message: ", (override: string) => {
            editRl.close();
            const overrideMsg = stripControlChars(override);
            if (overrideMsg.length === 0) {
              console.log("Commit aborted (empty override).");
              resolve(false);
              return;
            }
            resolve(runCommit(overrideMsg));
          });
        } else if (input === "r" || input === "regenerate") {
          if (!onRegenerate) {
            console.log("Regenerate not available. Aborting.");
            resolve(false);
            return;
          }
          console.log("[localcommit] Regenerating message...");
          onRegenerate()
            .then((newMessage) => {
              const cleaned = stripControlChars(newMessage);
              if (!cleaned) {
                console.log("Regenerated message was empty. Aborting.");
                resolve(false);
                return;
              }
              ask(cleaned);
            })
            .catch((err: unknown) => {
              console.error("Regeneration failed:", err instanceof Error ? err.message : String(err));
              resolve(false);
            });
        } else {
          console.log("Commit aborted.");
          resolve(false);
        }
      });
    };

    ask(message);
  });
}