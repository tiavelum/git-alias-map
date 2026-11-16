#!/usr/bin/env node
// The command line: reads the aliases of a gitconfig through git, and
// prints their summary or writes the editor page.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { analyze } from "./aliases.js";
import { editorPage } from "./editor.js";
import { aliasComments, parseAliasList } from "./gitconfig.js";
import { formatStats } from "./report.js";

const DEFAULT_CONFIG = `${homedir()}/vc/mac-config/gitconfig`;
const DEFAULT_PAGE = "git-alias-editor.html";
const USAGE = `Usage:
  node src/cli.js stats [gitconfig]
  node src/cli.js editor [gitconfig] [page.html]

Without a gitconfig, both read ${DEFAULT_CONFIG}.`;

function fail(message) {
  console.error(message);
  process.exit(2);
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readAliases(file) {
  try {
    return parseAliasList(
      git(["config", "-f", file, "-z", "--get-regexp", "^alias\\."]),
    );
  } catch (err) {
    // git config exits with 1 when the file defines no alias.
    if (err.status === 1) return [];
    fail(`${file}: git cannot read it: ${String(err.stderr).trim()}`);
  }
}

function nativeCommands() {
  return git(["--list-cmds=main"]).split("\n").filter(Boolean);
}

const tilde = (path) =>
  path.startsWith(homedir() + "/") ? "~" + path.slice(homedir().length) : path;

// Names the version of the file: its last commit when it lies in a git
// repository, otherwise the time it was last changed.
function versionLabel(file) {
  const dir = dirname(file),
    name = basename(file);
  try {
    const commit = git(["log", "-1", "--format=%h", "--", name], dir).trim();
    if (commit) {
      const dirty = git(["status", "--porcelain", "--", name], dir).trim();
      return dirty
        ? `commit ${commit} with uncommitted changes`
        : `commit ${commit}`;
    }
  } catch {
    // Not in a git repository: the time it was changed names the version.
  }
  return `the version of ${statSync(file).mtime.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function main([command, ...args]) {
  if (command !== "stats" && command !== "editor") fail(USAGE);
  const file = resolve(args[0] || DEFAULT_CONFIG);
  if (!existsSync(file)) fail(`${tilde(file)}: no such file`);
  const aliases = readAliases(file);
  const natives = nativeCommands();

  if (command === "stats") {
    const a = analyze(Object.fromEntries(aliases), new Set(natives));
    console.log(formatStats(args[0] || tilde(file), a).join("\n"));
    process.exit(a.stats.problems ? 1 : 0);
  }

  const out = resolve(args[1] || DEFAULT_PAGE);
  const page = editorPage({
    aliases,
    natives,
    comments: aliasComments(readFileSync(file, "utf8")),
    file: tilde(file),
    src: versionLabel(file),
    key: createHash("sha256")
      .update(JSON.stringify(aliases))
      .digest("hex")
      .slice(0, 12),
  });
  writeFileSync(out, page);
  console.log(
    `${args[1] || DEFAULT_PAGE}: ${aliases.length} aliases from ${args[0] || tilde(file)}`,
  );
}

main(process.argv.slice(2));
