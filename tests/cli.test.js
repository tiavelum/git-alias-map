import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const cli = new URL("../src/cli.js", import.meta.url).pathname;
const example = new URL("../examples/gitconfig", import.meta.url).pathname;
const run = (...args) =>
  spawnSync("node", [cli, ...args], { encoding: "utf8" });

describe("cli stats", () => {
  it("prints the summary of the example and exits with 0", () => {
    const r = run("stats", "examples/gitconfig");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.stdout.split("\n")[0],
      "examples/gitconfig: 12 aliases, 9 behaviours, 3 pure renames, 7 roots",
    );
  });
  it("exits with 1 when the file has a problem", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-alias-map-"));
    const file = join(dir, "gitconfig");
    writeFileSync(file, "[alias]\n\tz = nope\n");
    const r = run("stats", file);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /1 problem:/);
  });
  it("exits with 2 for a missing file or a wrong command", () => {
    assert.equal(run("stats", "no/such/gitconfig").status, 2);
    assert.equal(run("draw").status, 2);
  });
});

describe("cli editor", () => {
  it("writes the page with the aliases of the file", () => {
    const out = join(mkdtempSync(join(tmpdir(), "git-alias-map-")), "e.html");
    const r = run("editor", example, out);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /: 12 aliases from /);
    const page = readFileSync(out, "utf8");
    assert.match(page, /<title>Git alias editor<\/title>/);
    assert.match(page, /"puf","pu --force-with-lease"/);
  });
});
