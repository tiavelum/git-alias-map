import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  diff,
  exportBlock,
  flattenChains,
  parseRefs,
  removeAlias,
  renameAlias,
  replaceRef,
} from "../src/aliases.js";
import { parseAliasList } from "../src/gitconfig.js";

const NATIVES = new Set([
  "checkout",
  "status",
  "log",
  "push",
  "reset",
  "fetch",
]);

// The aliases of examples/gitconfig.
const EXAMPLE = {
  co: "checkout",
  st: "status",
  lg: "log --oneline --graph",
  lg10: "lg -10",
  l: "lg",
  ll: "l",
  pu: "push",
  puf: "pu --force-with-lease",
  undo: "reset --soft HEAD^",
  u: "undo",
  sync: "!git fetch --prune && git st",
  tidy: "!~/bin/git-tidy.sh",
};

describe("parseRefs", () => {
  it("takes the first word of a plain alias", () => {
    assert.deepEqual(parseRefs("lg -10", EXAMPLE, NATIVES), [
      { t: "alias", x: "lg" },
    ]);
  });
  it("takes every git call of a shell alias, once each", () => {
    assert.deepEqual(
      parseRefs("!git fetch && git st && git st", EXAMPLE, NATIVES),
      [
        { t: "native", x: "fetch" },
        { t: "alias", x: "st" },
      ],
    );
  });
  it("names the script of a shell alias that calls no git command", () => {
    assert.deepEqual(parseRefs("!~/bin/git-tidy.sh", EXAMPLE, NATIVES), [
      { t: "script", x: "git-tidy.sh" },
    ]);
  });
  it("marks a word that is neither an alias nor a git command", () => {
    assert.deepEqual(parseRefs("nope -x", EXAMPLE, NATIVES), [
      { t: "missing", x: "nope" },
    ]);
  });
});

describe("analyze", () => {
  const a = analyze(EXAMPLE, NATIVES);
  it("counts the alias hops down to git", () => {
    assert.equal(a.order.co, 1);
    assert.equal(a.order.l, 2);
    assert.equal(a.order.ll, 3);
    assert.equal(a.order.sync, 2);
    assert.deepEqual(a.stats.byOrder, { 1: 6, 2: 5, 3: 1 });
  });
  it("counts aliases, renames, behaviours and roots", () => {
    assert.equal(a.stats.total, 12);
    assert.equal(a.stats.renames, 3);
    assert.equal(a.stats.behaviours, 9);
    assert.equal(a.stats.roots, 7);
  });
  it("places a shell alias under the alias that gives it its order", () => {
    assert.deepEqual(a.primary.sync, { t: "alias", x: "st" });
    assert.deepEqual(a.also.sync, ["fetch"]);
  });
  it("lists the callers of an alias", () => {
    assert.deepEqual(a.dependents.lg.sort(), ["l", "lg10"]);
  });
  it("flags only the rename of a rename in the example", () => {
    assert.deepEqual(
      a.warnings.map((w) => [w.n, w.kind]),
      [["ll", "chain"]],
    );
    assert.equal(a.stats.problems, 0);
  });
  it("flags a missing name, a loop and an alias named like git", () => {
    const b = analyze({ x: "y", y: "x", status: "st", z: "nope" }, NATIVES);
    const found = b.warnings.map((w) => `${w.n}:${w.kind}`);
    assert.ok(found.includes("x:cycle"));
    assert.ok(found.includes("status:shadow"));
    assert.ok(found.includes("z:missing"));
  });
});

describe("edits", () => {
  it("re-points a plain and a shell caller", () => {
    assert.equal(replaceRef("lg -10", "lg", "log1"), "log1 -10");
    assert.equal(
      replaceRef("!git fetch && git st", "st", "s"),
      "!git fetch && git s",
    );
    assert.equal(replaceRef("!git status", "st", "s"), "!git status");
  });
  it("renames an alias and updates its callers on request", () => {
    const m = renameAlias(EXAMPLE, "st", "s", true);
    assert.equal(m.s, "status");
    assert.ok(!("st" in m));
    assert.equal(m.sync, "!git fetch --prune && git s");
    assert.equal(renameAlias(EXAMPLE, "st", "s", false).sync, EXAMPLE.sync);
  });
  it("points the callers of a removed rename at its target", () => {
    const r = removeAlias(EXAMPLE, "l", true, NATIVES);
    assert.equal(r.map.ll, "lg");
    assert.deepEqual(r.broken, []);
  });
  it("writes a removed plain value into a plain caller", () => {
    const r = removeAlias(EXAMPLE, "lg", true, NATIVES);
    assert.equal(r.map.lg10, "log --oneline --graph -10");
  });
  it("names a shell caller that removing a plain alias breaks", () => {
    const r = removeAlias({ ...EXAMPLE, st: "status -s" }, "st", true, NATIVES);
    assert.deepEqual(r.broken, ["sync"]);
  });
  it("points every rename of a rename at its final target", () => {
    const m = flattenChains(EXAMPLE);
    assert.equal(m.ll, "lg");
    assert.equal(analyze(m, NATIVES).stats.chains, 0);
  });
});

describe("diff", () => {
  it("reports removed, changed, renamed and added aliases", () => {
    const draft = { ...renameAlias(EXAMPLE, "co", "c", false), x: "status" };
    delete draft.ll;
    draft.lg10 = "lg -20";
    assert.deepEqual(
      diff(EXAMPLE, draft, { c: "co" }).map((c) => `${c.kind} ${c.n}`),
      ["changed lg10", "removed ll", "renamed c", "added x"],
    );
  });
});

describe("exportBlock", () => {
  it("writes a section that git reads back as the same aliases", () => {
    const map = { ...EXAMPLE, q: 'log --format="%h # %s"', w: "!echo a\\b" };
    const dir = mkdtempSync(join(tmpdir(), "git-alias-map-"));
    const file = join(dir, "gitconfig");
    writeFileSync(file, exportBlock(map, { u: ["# A comment."] }) + "\n");
    const read = execFileSync(
      "git",
      ["config", "-f", file, "-z", "--get-regexp", "^alias\\."],
      { encoding: "utf8" },
    );
    assert.deepEqual(Object.fromEntries(parseAliasList(read)), map);
  });
  it("keeps the comments above the aliases it writes", () => {
    const block = exportBlock({ u: "undo" }, { u: ["# A comment."] });
    assert.equal(block, "[alias]\n\t# A comment.\n\tu = undo");
  });
});
