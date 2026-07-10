/**
 * hash-password.mjs — turns the user's chosen password into the AUTH_PASS_HASH value.
 *
 * Run once, at Session-0 (plan §1.4, P0 step 5):
 *
 *     node scripts/hash-password.mjs
 *
 * It prompts for the password without echoing it, prints the bcrypt hash, and exits. The
 * plaintext is never written to disk, never passed as an argv (which would land in the shell
 * history and in `ps` output), and never logged. Copy the hash into AUTH_PASS_HASH — locally
 * and in Vercel, per Appendix D — then forget the plaintext.
 *
 * Cost 12 is the plan's figure (§4.4). It takes roughly a quarter of a second on modern
 * hardware, which is irrelevant for one login a month and expensive for an offline attacker.
 */
import { hash } from "bcryptjs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const BCRYPT_COST = 12;

/**
 * Reads a line from the terminal without echoing the characters back.
 *
 * readline has no built-in silent mode, so we intercept the output stream's writes while the
 * question is pending. The `muted` flag is flipped off before we print anything ourselves.
 */
function askSecretly(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    let muted = false;

    // eslint-disable-next-line no-underscore-dangle
    const originalWrite = rl._writeToOutput?.bind(rl);
    // eslint-disable-next-line no-underscore-dangle
    rl._writeToOutput = (chunk) => {
      if (muted) return; // swallow the echoed characters
      originalWrite?.(chunk);
    };

    rl.question(question, (answer) => {
      muted = false;
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

const password = await askSecretly("Choose the app login password: ");

if (password.length < 12) {
  console.error(
    "\nRefusing: use at least 12 characters. This is the only credential guarding the whole\n" +
      "app, there is no rate limit worth the name on a serverless platform, and you will type\n" +
      "it roughly once a month.",
  );
  process.exit(1);
}

const digest = await hash(password, BCRYPT_COST);

console.log("AUTH_PASS_HASH=" + digest);
console.log(
  "\nPlace this in .env and in Vercel (Appendix D). The plaintext is not stored anywhere —\n" +
    "if you forget it, re-run this script with a new password.",
);
