// The lines `stats` prints for an analysis made by analyze() in aliases.js.

export function formatStats(label, a) {
  const s = a.stats;
  const hops = Object.keys(s.byOrder)
    .map(Number)
    .sort((x, y) => x - y)
    .map((o) => `${o}: ${s.byOrder[o]}`)
    .join(", ");
  const lines = [
    `${label}: ${s.total} aliases, ${s.behaviours} behaviours, ${s.renames} pure renames, ${s.roots} roots`,
    `aliases by hops to git: ${hops || "none"}`,
  ];
  const problems = a.warnings.filter((w) => w.kind !== "chain");
  const chains = a.warnings.filter((w) => w.kind === "chain");
  if (problems.length) {
    lines.push(`${problems.length} problem${problems.length > 1 ? "s" : ""}:`);
    for (const w of problems) lines.push(`  ${w.n} ${w.text}`);
  } else lines.push("no problems");
  if (chains.length) {
    lines.push(
      `${chains.length} rename${chains.length > 1 ? "s" : ""} of a rename:`,
    );
    for (const w of chains) lines.push(`  ${w.n} ${w.text}`);
  }
  return lines;
}
