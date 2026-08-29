// lcov -> markdown summary for $GITHUB_STEP_SUMMARY.
// Reads a bun-produced lcov.info (SF:/LF:/LH: sections) and prints a
// per-file line-coverage table plus totals. No third-party coverage
// service or action — the lcov artifact stays the source of truth.

export {};

// Run: bun scripts/coverage-summary.ts [path/to/lcov.info]
const path = process.argv[2] ?? "coverage/lcov.info";
const text = await Bun.file(path).text();

const rows: { file: string; hit: number; total: number }[] = [];
let file = "";
let lf = 0;
let lh = 0;
for (const line of text.split("\n")) {
  if (line.startsWith("SF:")) {
    file = line.slice(3);
    lf = 0;
    lh = 0;
  } else if (line.startsWith("LF:")) {
    lf = Number(line.slice(3));
  } else if (line.startsWith("LH:")) {
    lh = Number(line.slice(3));
    if (file) rows.push({ file, hit: lh, total: lf });
  }
}

if (rows.length === 0) {
  console.error(`coverage-summary: no SF/LF/LH records found in ${path}`);
  process.exit(1);
}

rows.sort((a, b) => a.hit / a.total - b.hit / b.total);
const pct = (r: { hit: number; total: number }) =>
  r.total === 0 ? "—" : `${((100 * r.hit) / r.total).toFixed(1)}%`;
const total = rows.reduce((a, r) => ({ hit: a.hit + r.hit, total: a.total + r.total }), { hit: 0, total: 0 });

console.log("| File | Lines | Coverage |");
console.log("|---|---|---|");
for (const r of rows) console.log(`| \`${r.file}\` | ${r.hit}/${r.total} | ${pct(r)} |`);
console.log(`| **Total** | **${total.hit}/${total.total}** | **${pct(total)}** |`);
