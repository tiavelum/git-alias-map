import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/aliases.js";
import { formatStats } from "../src/report.js";

const NATIVES = new Set(["status", "log"]);

describe("formatStats", () => {
  it("prints the counts, the hops and a rename of a rename", () => {
    const a = analyze({ st: "status", s: "st", ss: "s" }, NATIVES);
    assert.deepEqual(formatStats("cfg", a), [
      "cfg: 3 aliases, 1 behaviours, 2 pure renames, 1 roots",
      "aliases by hops to git: 1: 1, 2: 1, 3: 1",
      "no problems",
      "1 rename of a rename:",
      "  ss renames s, which itself only renames st",
    ]);
  });
  it("lists each problem", () => {
    const a = analyze({ z: "nope" }, NATIVES);
    assert.deepEqual(formatStats("cfg", a).slice(2), [
      "1 problem:",
      "  z calls nope, which is neither an alias nor a git command",
    ]);
  });
});
