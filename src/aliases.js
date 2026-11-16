// The analysis and the edits of a set of git aliases, given as an object
// from alias name to value. Every function here also runs in the editor
// page, which embeds their source, so they use no imports and no module
// state, and call one another only by name.

export const GIT_CALL = /\bgit\s+(?:-c\s+\S+\s+)?([a-z][\w-]*)/g;

export function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isShell(v) {
  return v.startsWith("!");
}

// What an alias value calls: for a shell alias every `git <name>` in it,
// or the script it runs when it calls git nowhere; for a plain alias its
// first word. Each is an alias, a native git command, a script or missing.
export function parseRefs(v, map, natives) {
  const kind = (x) =>
    x in map ? "alias" : natives.has(x) ? "native" : "missing";
  if (isShell(v)) {
    const out = [];
    for (const m of v.matchAll(GIT_CALL)) {
      const x = m[1];
      if (!out.some((r) => r.x === x)) out.push({ t: kind(x), x });
    }
    if (!out.length) {
      const first = v.slice(1).trim().split(/\s+/)[0] || "(empty)";
      out.push({ t: "script", x: first.split("/").pop() });
    }
    return out;
  }
  const w = v.trim().split(/\s+/)[0] || "";
  return [{ t: w ? kind(w) : "missing", x: w || "(empty)" }];
}

// A pure rename only gives another alias a new name, without arguments.
export function isRename(v, map) {
  return !isShell(v) && v.trim().split(/\s+/).length === 1 && v.trim() in map;
}

// The order of an alias is the number of alias hops down to git: 1 when it
// calls git directly, one more than the deepest alias it calls otherwise.
export function analyze(map, natives) {
  const names = Object.keys(map);
  const refs = {},
    order = {},
    state = {},
    cycle = new Set();
  for (const n of names) refs[n] = parseRefs(map[n], map, natives);
  const ord = (n) => {
    if (order[n] != null) return order[n];
    if (state[n] === 1) {
      cycle.add(n);
      return 0;
    }
    state[n] = 1;
    let m = 0;
    for (const r of refs[n]) if (r.t === "alias") m = Math.max(m, ord(r.x));
    state[n] = 2;
    return (order[n] = m + 1);
  };
  names.forEach(ord);

  const rootKey = (r) =>
    r.t === "script"
      ? "script: " + r.x
      : r.t === "missing"
        ? "missing: " + r.x
        : r.x;
  // An alias sits under the alias that gives it its order, or under the
  // git command, script or missing name it calls when it calls no alias.
  const primary = {},
    also = {};
  for (const n of names) {
    const rs = refs[n],
      al = rs.filter((r) => r.t === "alias");
    let p;
    if (al.length) {
      const m = Math.max(...al.map((r) => order[r.x]));
      p = { t: "alias", x: al.find((r) => order[r.x] === m).x };
    } else {
      const r = isShell(map[n]) ? rs[rs.length - 1] : rs[0];
      p = { t: "root", x: rootKey(r) };
    }
    primary[n] = p;
    also[n] = rs
      .filter((r) => !(p.t === "alias" ? r.x === p.x : rootKey(r) === p.x))
      .map((r) => r.x);
  }

  const memo = {};
  const rootsOf = (n, seen = new Set()) => {
    if (memo[n]) return memo[n];
    if (seen.has(n)) return new Set();
    seen.add(n);
    const s = new Set();
    for (const r of refs[n]) {
      if (r.t === "alias") rootsOf(r.x, seen).forEach((x) => s.add(x));
      else s.add(rootKey(r));
    }
    return (memo[n] = s);
  };
  const allRoots = new Set();
  names.forEach((n) => rootsOf(n).forEach((x) => allRoots.add(x)));

  const dependents = {};
  names.forEach((n) => (dependents[n] = []));
  for (const n of names)
    for (const r of refs[n])
      if (r.t === "alias" && r.x !== n) dependents[r.x].push(n);

  const rename = {};
  names.forEach((n) => (rename[n] = isRename(map[n], map)));

  const warnings = [];
  for (const n of names) {
    for (const r of refs[n])
      if (r.t === "missing")
        warnings.push({
          n,
          kind: "missing",
          text: `calls ${r.x}, which is neither an alias nor a git command`,
        });
    if (cycle.has(n))
      warnings.push({
        n,
        kind: "cycle",
        text: "is part of a loop of aliases calling each other",
      });
    if (natives.has(n))
      warnings.push({
        n,
        kind: "shadow",
        text: `has the name of the git command ${n}, so git ignores it`,
      });
    if (rename[n] && rename[map[n].trim()])
      warnings.push({
        n,
        kind: "chain",
        text: `renames ${map[n].trim()}, which itself only renames ${map[map[n].trim()].trim()}`,
      });
  }

  const byOrder = {};
  names.forEach((n) => (byOrder[order[n]] = (byOrder[order[n]] || 0) + 1));
  const renames = names.filter((n) => rename[n]).length;
  const roots = [...allRoots].filter((x) => !x.startsWith("missing: "));
  return {
    names,
    refs,
    order,
    primary,
    also,
    dependents,
    rename,
    warnings,
    cycle,
    stats: {
      total: names.length,
      behaviours: names.length - renames,
      renames,
      roots: roots.length,
      byOrder,
      maxOrder: Math.max(0, ...names.map((n) => order[n])),
      problems: warnings.filter((w) => w.kind !== "chain").length,
      chains: warnings.filter((w) => w.kind === "chain").length,
    },
  };
}

// Points a call to the alias `from` at `to`: every `git from` in a shell
// alias, or the first word of a plain one.
export function replaceRef(v, from, to) {
  if (isShell(v)) {
    const re = new RegExp(
      "(\\bgit\\s+(?:-c\\s+\\S+\\s+)?)" + escRe(from) + "(?![\\w-])",
      "g",
    );
    return v.replace(re, "$1" + to);
  }
  const parts = v.trim().split(/(\s+)/);
  if (parts[0] === from) {
    parts[0] = to;
    return parts.join("");
  }
  return v;
}

export function renameAlias(map, from, to, updateRefs) {
  const out = {};
  for (const [n, v] of Object.entries(map)) {
    const nv = updateRefs && n !== from ? replaceRef(v, from, to) : v;
    out[n === from ? to : n] = nv;
  }
  return out;
}

// Removing an alias whose value is a single word (an alias or a git
// command) points its callers at that word; a plain caller of any plain
// alias gets the removed value written in. Returns the new map and the
// callers left broken.
export function removeAlias(map, n, repoint, natives) {
  const v = map[n],
    out = { ...map };
  delete out[n];
  const broken = [];
  const deps = Object.keys(map).filter(
    (d) =>
      d !== n &&
      parseRefs(map[d], map, natives).some((r) => r.t === "alias" && r.x === n),
  );
  const single = !isShell(v) && v.trim().split(/\s+/).length === 1;
  for (const d of deps) {
    if (repoint && (single || (!isShell(v) && !isShell(map[d]))))
      out[d] = replaceRef(map[d], n, v.trim());
    else broken.push(d);
  }
  return { map: out, broken };
}

// Points every rename of a rename straight at the alias its chain of
// renames ends in.
export function flattenChains(map) {
  const out = { ...map };
  for (const n of Object.keys(map)) {
    if (!isRename(map[n], map)) continue;
    let t = map[n].trim();
    const seen = new Set([n]);
    while (isRename(map[t], map) && !seen.has(t)) {
      seen.add(t);
      t = map[t].trim();
    }
    out[n] = t;
  }
  return out;
}

// Quotes a value the way git config reads it back unchanged.
export function quoteValue(v) {
  if (!/[;#"\\]/.test(v) && !/^\s|\s$/.test(v)) return v;
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function exportBlock(map, comments) {
  const lines = ["[alias]"];
  for (const n of Object.keys(map).sort()) {
    for (const c of comments[n] || []) lines.push("\t" + c);
    lines.push("\t" + n + " = " + quoteValue(map[n]));
  }
  return lines.join("\n");
}

// The changes from `base` to `draft`. `renamedFrom` maps a new name to the
// name it had in `base`, so a rename shows as one change.
export function diff(base, draft, renamedFrom) {
  const out = [],
    renamedOld = new Set(Object.values(renamedFrom));
  for (const n of Object.keys(base).sort()) {
    if (!(n in draft)) {
      if (!renamedOld.has(n)) out.push({ kind: "removed", n, before: base[n] });
    } else if (base[n] !== draft[n])
      out.push({ kind: "changed", n, before: base[n], after: draft[n] });
  }
  for (const n of Object.keys(draft).sort()) {
    if (n in base) continue;
    const old = renamedFrom[n];
    if (old && old in base && !(old in draft))
      out.push({ kind: "renamed", n, old, before: base[old], after: draft[n] });
    else out.push({ kind: "added", n, after: draft[n] });
  }
  return out;
}

// The functions the editor page needs, in an order in which each is
// defined before the page script runs.
export const BROWSER_FUNCTIONS = [
  escRe,
  isShell,
  parseRefs,
  isRename,
  analyze,
  replaceRef,
  renameAlias,
  removeAlias,
  flattenChains,
  quoteValue,
  exportBlock,
  diff,
];
