#!/usr/bin/env node
/**
 * vrt-diff.mjs — decode every candidate baseline against its committed twin and count differing
 * pixels. The committed tool the standing VRT law asks for ("diff every candidate, decode both,
 * count differing pixels"), so that mandatory step is a command instead of a hand-roll re-derived
 * every endgame — the orphaned root pixelmatch/pngjs install proved it had been re-derived before.
 *
 * Why it exists at all: a `maxDiffPixels` tolerance means a shot can CHANGE and still PASS, so the
 * failure list is not the change list. This reports EVERY candidate — a moved-but-tolerated shot is
 * still a wrong baseline. A resize is louder than a diff (a shot whose height changed changed its
 * layout), so dimension changes print first and loudest.
 *
 * RUN IT FROM app/ — pngjs and pixelmatch resolve from app/node_modules, where Playwright already
 * carries them; there is no separate install (that separate install was the residue LC1 deleted).
 *
 *   node scripts/vrt-diff.mjs <candidate-dir> [committed-dir]
 *
 * <candidate-dir>  a downloaded vrt-baselines-candidate-<leg> artifact (a directory of PNGs).
 * [committed-dir]  the baselines to compare against; defaults to e2e/vrt.spec.ts-snapshots.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const candidateDir = process.argv[2];
const committedDir = process.argv[3] ?? "e2e/vrt.spec.ts-snapshots";

if (!candidateDir) {
  console.error("usage: node scripts/vrt-diff.mjs <candidate-dir> [committed-dir]");
  process.exit(1);
}
if (!existsSync(candidateDir)) {
  console.error(`candidate directory not found: ${candidateDir}`);
  process.exit(1);
}

const files = readdirSync(candidateDir)
  .filter((f) => f.endsWith(".png"))
  .sort();

// Classify each candidate before printing, so the loud findings (resize, new) lead and the changed
// shots sort by how much they moved. A row is only reassuring once you have seen it near the top.
const resized = [];
const added = [];
const changed = [];
const unchanged = [];

for (const name of files) {
  const candidate = PNG.sync.read(readFileSync(join(candidateDir, name)));
  const committedPath = join(committedDir, name);
  if (!existsSync(committedPath)) {
    added.push(name);
    continue;
  }
  const committed = PNG.sync.read(readFileSync(committedPath));
  if (candidate.width !== committed.width || candidate.height !== committed.height) {
    resized.push({ name, from: `${committed.width}x${committed.height}`, to: `${candidate.width}x${candidate.height}` });
    continue;
  }
  const diff = pixelmatch(candidate.data, committed.data, null, candidate.width, candidate.height, {
    threshold: 0.1,
  });
  (diff > 0 ? changed : unchanged).push({ name, diff });
}

for (const r of resized) {
  console.log(`RESIZED     ${r.name.padEnd(38)} ${r.from} -> ${r.to}`);
}
for (const name of added) {
  console.log(`NEW         ${name.padEnd(38)} (no committed baseline)`);
}
for (const c of changed.sort((a, b) => b.diff - a.diff)) {
  console.log(`CHANGED     ${c.name.padEnd(38)} ${c.diff} differing px`);
}
for (const u of unchanged) {
  console.log(`unchanged   ${u.name.padEnd(38)} 0 differing px`);
}

console.log(
  `\n${files.length} candidates · ${resized.length} resized · ${added.length} new · ` +
    `${changed.length} changed · ${unchanged.length} unchanged`,
);
