#!/usr/bin/env node
/**
 * check:migrations — is the database the app actually talks to running the schema in this repo?
 *
 * THE BUG THIS EXISTS FOR (N2, 2026-07-13).
 *
 * N0 authored a migration adding five tables and a column. It was committed, reviewed, and CI ran
 * it green on every push since. Production never got it.
 *
 * Nothing was broken about the migration. What was broken was the belief that CI proved anything
 * about production: CI spins up a FRESH POSTGRES CONTAINER and runs `migrate deploy` into it, so a
 * green CI proves only that the migration APPLIES — never that it was applied to the database the
 * deployed app reads. And the app's loaders all catch a database error and degrade to their honest
 * empty state (which is correct, and which every other gate depends on), so the missing column did
 * not crash anything. It just quietly made the Macro Pulse degrade, every night, for exactly the
 * reason the current plan's Part 1 was written to eliminate.
 *
 * A green pipeline and a silently wrong production is the disease. This is the thermometer.
 *
 * It runs against whatever DATABASE_URL is configured, which locally is production (there is no
 * local Postgres on this machine — CI's service container is the only other database that exists).
 * The deploy applies migrations too now (vercel.json's buildCommand), so this is the belt to that
 * brace: it fails BEFORE a push rather than during one.
 *
 * Exit 0 = the database is up to date. Exit 1 = a migration on disk has never been applied.
 * If no DATABASE_URL is reachable at all, it says so and exits 0 — a developer with no database is
 * not a developer with a drifted one, and a gate that fails for the wrong reason gets ignored.
 */

import { execFileSync } from "node:child_process";

let output;
try {
  output = execFileSync("npx", ["prisma", "migrate", "status"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  // `migrate status` exits non-zero when migrations are PENDING — which is the case we care about —
  // and also when it simply cannot reach a database. The two are told apart by what it printed.
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;

  if (/can't reach database|Can't reach database|P1001/i.test(output)) {
    console.log("○ check:migrations — no database reachable; nothing to compare against. Skipping.");
    process.exit(0);
  }
}

if (/have not yet been applied|Following migration/i.test(output)) {
  const pending = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d{14}_/.test(line));

  console.error("\n✗ check:migrations — the database is BEHIND the migrations in this repo.\n");
  for (const name of pending) console.error(`    pending: ${name}`);
  console.error(
    "\n  This is the exact gap that let N0's schema sit unapplied in production while every\n" +
      "  CI run went green: CI migrates a fresh container, so it can never see this.\n\n" +
      "  Apply it:  npx prisma migrate deploy\n",
  );
  process.exit(1);
}

console.log("✓ check:migrations — the database is running the schema in this repo.");
