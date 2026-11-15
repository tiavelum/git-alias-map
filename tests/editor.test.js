import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { editorPage } from "../src/editor.js";
import { aliasComments, parseAliasList } from "../src/gitconfig.js";

const example = new URL("../examples/gitconfig", import.meta.url).pathname;
const aliases = parseAliasList(
  execFileSync(
    "git",
    ["config", "-f", example, "-z", "--get-regexp", "^alias\\."],
    {
      encoding: "utf8",
    },
  ),
);
const page = editorPage({
  aliases,
  natives: ["checkout", "status", "log", "push", "reset", "fetch"],
  comments: aliasComments(readFileSync(example, "utf8")),
  file: "examples/gitconfig",
  src: "a test",
  key: "test",
});
const file = join(mkdtempSync(join(tmpdir(), "git-alias-map-")), "e.html");
writeFileSync(file, page);

// CHROME_PATH runs the test with an installed Chrome where Playwright's own
// Chromium is not downloaded.
let browser, tab;
before(async () => {
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  );
});
after(() => browser.close());

async function open() {
  tab = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  tab.on("pageerror", (e) => errors.push(String(e)));
  await tab.goto("file://" + file);
  return errors;
}
const boxes = () =>
  tab
    .locator(".cd")
    .evaluateAll((cards) =>
      cards.map((c) => Object.values(c.getBoundingClientRect().toJSON())),
    );
const stat = (label) =>
  tab.locator(".sc", { hasText: label }).first().locator(".v").innerText();
async function exported() {
  await tab.click("button[data-act=export]");
  return tab.inputValue("#ex-block");
}

describe("editor page", () => {
  it("shows the counts of the file and starts with no change", async () => {
    const errors = await open();
    assert.equal(await stat("Aliases"), "12");
    assert.equal(await stat("Pure renames"), "3");
    assert.equal(
      await tab.innerText("#status"),
      "Draft: same as the current file. Click an alias to edit it.",
    );
    assert.deepEqual(errors, []);
  });

  it("keeps every card in place between draft and current file", async () => {
    await open();
    await tab.click('.row[data-n="l"]');
    await tab.click("button[data-act=delete]");
    const draft = await boxes();
    await tab.click("button[data-view=current]");
    assert.deepEqual(await boxes(), draft);
    assert.match(await tab.innerText('.row[data-n="l"]'), /removed in draft/);
  });

  it("points the callers of a deleted rename at its target", async () => {
    await open();
    await tab.click('.row[data-n="l"]');
    await tab.click("button[data-act=delete]");
    assert.match(await exported(), /\tll = lg\n/);
    assert.equal(await stat("Aliases"), "11");
  });

  it("renames an alias and the shell alias that calls it", async () => {
    await open();
    await tab.click('.row[data-n="st"]');
    await tab.fill("#e-name", "s");
    await tab.click("button[data-act=save]");
    const block = await exported();
    assert.match(block, /\ts = status\n/);
    assert.match(block, /\tsync = !git fetch --prune && git s\n/);
    await tab.click("button[data-view=changes]");
    assert.match(await tab.innerText("#main"), /st → s/);
  });

  it("keeps what was typed when a name is refused", async () => {
    await open();
    await tab.click("button[data-act=add]");
    await tab.fill("#e-name", "st");
    await tab.fill("#e-val", "status -s");
    await tab.click("button[data-act=save]");
    assert.equal(await tab.innerText(".editor .err"), "st already exists.");
    assert.equal(await tab.inputValue("#e-val"), "status -s");
  });

  it("exports the comments above the aliases it keeps", async () => {
    await open();
    assert.match(
      await exported(),
      /\t# Undoes the last commit and keeps its changes staged.\n\tundo = /,
    );
  });
});
