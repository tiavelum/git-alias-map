// Turns what git reports about a gitconfig into alias data. Reading the
// file is left to git, which knows its quoting and escapes; this module
// only takes git's output and the file's text.

// The aliases from the output of `git config -z --get-regexp ^alias\.`,
// where each entry is the key, a newline and the value, ended by NUL.
export function parseAliasList(output) {
  return output
    .split("\0")
    .filter((entry) => entry.startsWith("alias."))
    .map((entry) => {
      const i = entry.indexOf("\n");
      const key = i < 0 ? entry : entry.slice(0, i);
      const value = i < 0 ? "" : entry.slice(i + 1);
      return [key.slice("alias.".length), value];
    });
}

// The comment lines that stand directly above an alias in the [alias]
// sections of the file's text, by alias name, so an export keeps them.
export function aliasComments(text) {
  const comments = {};
  let inAlias = false,
    pending = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inAlias = /^\[alias\]$/i.test(line);
      pending = [];
    } else if (!inAlias) continue;
    else if (line.startsWith("#") || line.startsWith(";")) pending.push(line);
    else if (line.includes("=")) {
      if (pending.length) comments[line.split("=")[0].trim()] = pending;
      pending = [];
    } else if (!line) pending = [];
  }
  return comments;
}
