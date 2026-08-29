// Coverage gate: non-decreasing total + 80% on new code.
//
// Rules (both computed from lcov DA records — deterministic under the
// CI-pinned bun):
//   1. Ratchet: total line coverage must not decrease vs the base lcov.
//   2. Patch:   >= 80% of NEW executable lines in src/ must be covered.
//      Non-executable added lines (no DA record) don't count against you.
//
// Failing either rule exits 1 — this is a CI gate, not a report.
// A markdown table goes to stdout for $GITHUB_STEP_SUMMARY.
//
// Run: bun scripts/coverage-gate.ts <current.lcov> <base.lcov> <base-ref>
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export {};

const [currentLcov, baseLcov, baseRef] = process.argv.slice(2);
if (!currentLcov || !baseLcov || !baseRef) {
  console.error("usage: coverage-gate.ts <current.lcov> <base.lcov> <base-ref>");
  process.exit(2);
}

type FileCov = Map<number, number>; // line -> execution count

function parseLcov(path: string): Map<string, FileCov> {
  const files = new Map<string, FileCov>();
  let file = "";
  let lines: FileCov = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("SF:")) {
      file = line.slice(3);
      lines = new Map();
    } else if (line.startsWith("DA:")) {
      const [ln, cnt] = line.slice(3).split(",");
      lines.set(Number(ln), Number(cnt));
    } else if (line === "end_of_record" && file) {
      files.set(file, lines);
      file = "";
    }
  }
  return files;
}

const cur = parseLcov(currentLcov);
const base = parseLcov(baseLcov);

function total(cov: Map<string, FileCov>) {
  let hit = 0, all = 0;
  for (const lines of cov.values()) {
    for (const c of lines.values()) {
      all++;
      if (c > 0) hit++;
    }
  }
  return { hit, all, pct: all === 0 ? 100 : (100 * hit) / all };
}

const tCur = total(cur);
const tBase = total(base);

// --- Rule 2: patch coverage on src/ ---------------------------------------
const diff = execSync(`git diff --unified=0 --diff-filter=AM ${baseRef} HEAD -- src/`, {
  encoding: "utf8",
  maxBuffer: 1 << 26,
});
const diffFiles: string[] = [];
let file = "";
let added = 0, addedCovered = 0;
const misses: string[] = [];
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
    diffFiles.push(file);
  } else if (line.startsWith("@@")) {
    const m = /\+(\d+)(?:,(\d+))?/.exec(line);
    if (!m) continue;
    const lcovLines = cur.get(file);
    if (!lcovLines) continue; // never-loaded file: handled wholesale below
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let ln = start; ln < start + count; ln++) {
      const cnt = lcovLines.get(ln);
      if (cnt === undefined) continue; // non-executable line
      added++;
      if (cnt > 0) addedCovered++;
      else if (misses.length < 25) misses.push(`${file}:${ln}`);
    }
  }
}
// A file with no lcov section was never loaded by the tests — every
// added line in it counts as uncovered (comments/blanks included; a
// genuinely tested new file always gets a section when first imported).
for (const f of diffFiles) {
  if (cur.has(f)) continue;
  const body = execSync(`git diff --unified=0 --diff-filter=A ${baseRef} HEAD -- ${f}`, {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  for (const line of body.split("\n")) {
    if (!line.startsWith("@@")) continue;
    const m = /\+(\d+)(?:,(\d+))?/.exec(line);
    if (!m) continue;
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let ln = start; ln < start + count; ln++) {
      added++;
      if (misses.length < 25) misses.push(`${f}:${ln} (never loaded by tests)`);
    }
  }
}

const patchPct = added === 0 ? null : (100 * addedCovered) / added;
const EPS = 0.05; // percentage points; float/rounding safety, not a loophole
const ratchetOk = tCur.pct >= tBase.pct - EPS;
const patchOk = patchPct === null || patchPct >= 80;

const row = (label: string, v: string, ok: boolean | null) =>
  `| ${label} | ${v} | ${ok === null ? "n/a" : ok ? "✅" : "❌"} |`;
console.log("## Coverage gate");
console.log("| Rule | Value | |");
console.log("|---|---|---|");
console.log(row("Total (ratchet, non-decreasing)", `${tCur.pct.toFixed(1)}% (was ${tBase.pct.toFixed(1)}% at ${baseRef.slice(0, 7)})`, ratchetOk));
console.log(row("New src/ lines ≥ 80%", patchPct === null ? "no new executable lines" : `${patchPct.toFixed(1)}% (${addedCovered}/${added})`, patchOk));

if (!ratchetOk) {
  console.error(`coverage-gate: total coverage decreased ${tBase.pct.toFixed(2)}% -> ${tCur.pct.toFixed(2)}%. Add tests or restore coverage.`);
}
if (!patchOk) {
  console.error(`coverage-gate: new code coverage ${(patchPct ?? 0).toFixed(1)}% < 80% (${addedCovered}/${added} covered lines). Uncovered:`);
  for (const m of misses) console.error(`  ${m}`);
}
process.exit(ratchetOk && patchOk ? 0 : 1);
