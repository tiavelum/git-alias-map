import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aliasComments, parseAliasList } from "../src/gitconfig.js";

describe("parseAliasList", () => {
  it("splits git's NUL-separated output into names and values", () => {
    const output =
      "alias.st\nstatus\0alias.lg\nlog --oneline\0alias.x\nline one\nline two\0";
    assert.deepEqual(parseAliasList(output), [
      ["st", "status"],
      ["lg", "log --oneline"],
      ["x", "line one\nline two"],
    ]);
  });
  it("returns nothing for empty output", () => {
    assert.deepEqual(parseAliasList(""), []);
  });
});

describe("aliasComments", () => {
  it("keeps the comment lines directly above an alias", () => {
    const text = [
      "[user]",
      "\t# not an alias comment",
      "\tname = Someone",
      "[alias]",
      "\t# Two lines",
      "\t# of comment.",
      "\tu = undo",
      "\t# Stands apart.",
      "",
      "\tst = status",
      "\tco = checkout",
    ].join("\n");
    assert.deepEqual(aliasComments(text), {
      u: ["# Two lines", "# of comment."],
    });
  });
});
