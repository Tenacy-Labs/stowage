// lcov -> markdown summary for $GITHUB_STEP_SUMMARY.
// Reads a bun-produced lcov.info and prints a per-file line-coverage
// table plus totals, aggregated over DA records (executable lines) —
// the same basis scripts/coverage-gate.ts gates on. Note: bun's LF:/LH:
// fields count ALL source lines, so they understate coverage; DA records
// are the honest denominator. No third-party coverage service or action
// — the lcov artifact stays the source of truth.
//
// Run: bun scripts/coverage-summary.ts [path/to/lcov.info]
import { readFileSync } from "node:fs";

export {};

const path = process.argv[2] ?? "coverage/lcov.info";

type FileCov = Map<number, number>; // line -> execution count
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

if (files.size === 0) {
  console.error(`coverage-summary: no SF/DA records found in ${path}`);
  process.exit(1);
}

const rows = [...files.entries()].map(([f, l]) => ({
  file: f,
  hit: [...l.values()].filter((c) => c > 0).length,
  total: l.size,
}));
rows.sort((a, b) => a.hit / a.total - b.hit / b.total);
const pct = (r: { hit: number; total: number }) =>
  r.total === 0 ? "—" : `${((100 * r.hit) / r.total).toFixed(1)}%`;
const t = rows.reduce((a, r) => ({ hit: a.hit + r.hit, total: a.total + r.total }), { hit: 0, total: 0 });

console.log("| File | Lines (executable) | Coverage |");
console.log("|---|---|---|");
for (const r of rows) console.log(`| \`${r.file}\` | ${r.hit}/${r.total} | ${pct(r)} |`);
console.log(`| **Total** | **${t.hit}/${t.total}** | **${pct(t)}** |`);
