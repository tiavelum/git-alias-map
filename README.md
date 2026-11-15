# git-alias-map

A tool for keeping the git aliases of a `gitconfig` small and understandable: it shows which alias calls which, down to the git command each chain ends in, and writes an editor page in which they can be reduced. The repository holds the tool only, no alias data.

## What it is for

Aliases that call aliases pile up into chains, such as a short name for a short name for a long one, until it is hard to tell what calls what. The tool counts the alias hops from each alias down to git, points out renames of renames and broken calls, and lets you rename, re-point, delete and add aliases in a page that compares the draft with the file and exports the new `[alias]` section.

It does not change the `gitconfig` itself: you paste the exported section into the file.

## Getting started

Requires macOS or Linux, git 2.43 or later and Node.js 22 or later. On a Mac, install Node.js with Homebrew and check its version:

```sh
brew install node
node --version
```

Then get the tool and run it on the invented example:

```sh
git clone https://github.com/tiavelum/git-alias-map.git ~/vc/git-alias-map
cd ~/vc/git-alias-map
npm ci
node src/cli.js stats examples/gitconfig
```

The last command reads the example's aliases and prints:

```
examples/gitconfig: 12 aliases, 9 behaviours, 3 pure renames, 7 roots
aliases by hops to git: 1: 6, 2: 5, 3: 1
no problems
1 rename of a rename:
  ll renames l, which itself only renames lg
```

## Open the editor

```sh
node src/cli.js editor examples/gitconfig
open git-alias-editor.html
```

It writes `git-alias-editor.html` into the current folder, or to the path given after the file, and prints:

```
git-alias-editor.html: 12 aliases from examples/gitconfig
```

The page is one HTML file that opens in any browser, light or dark, without a network. It shows each alias in a card for the git command its chain ends in, indented under the alias it calls, with its number of hops to git. Three tabs:

- **Draft:** click an alias to rename it, change its value or delete it; "Add alias" adds one. Deleting an alias points its callers at what it ran. Renaming can update the aliases that call it.
- **Current file:** the file as it is, with tags that show what the draft changes. Both tabs draw the same cards at the same size, so switching between them moves nothing.
- **Changes:** every difference between the draft and the file, each with a button to revert it.

Export shows the new `[alias]` section and a list of the changes, each with a Copy button. The draft is kept in the browser until the aliases of the file change. `git-alias-editor.html` is ignored by git, because it holds the aliases of the file it was written from.

Without a file, `editor` reads `~/vc/mac-config/gitconfig`.

## Check a gitconfig

```sh
node src/cli.js stats ~/vc/mac-config/gitconfig
```

It prints the summary shown under Getting started, followed by every problem: a call to a name that is neither an alias nor a git command, aliases calling each other in a loop, or an alias named like a git command, which git ignores. Without a file it reads `~/vc/mac-config/gitconfig`. Exit code 0 means no problem, 1 problems in the file, 2 a missing file or wrong arguments.

## Apply a draft

1. In the editor, press Export and then Copy beside "[alias] section".
2. Replace the whole `[alias]` section of the `gitconfig` with what you copied.
3. Check the result:

```sh
node src/cli.js stats ~/vc/mac-config/gitconfig
```

It prints the counts the editor showed for the draft.

## Content and structure

| Path                                                      | Contains                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`src/`](src/README.md)                                   | The tool; `src/cli.js` is the entry point. Its README describes the modules and their layers.    |
| `tests/`                                                  | The tests, which `node --test` runs, among them one that opens the editor page in a browser.     |
| `examples/`                                               | `gitconfig`, an invented file for trying the tool and for the tests.                             |
| `scripts/`                                                | `module-diagram.js`, which writes the diagram of the imports into `src/README.md` and checks it. |
| `.github/workflows/`                                      | The CI check of every pull request and every push to `main`.                                     |
| `package.json`, `package-lock.json`                       | The scripts and the pinned development tools.                                                    |
| `.nvmrc`                                                  | The Node.js version CI runs.                                                                     |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore` | The linter and formatter configuration.                                                          |
| `.editorconfig`                                           | Charset, indentation and line endings for every file.                                            |
| `project-instructions.md`, `CLAUDE.md`                    | Rules for Claude sessions that work on this repository.                                          |

## How it works

`src/cli.js` asks git for the aliases of the file, with `git config -z --get-regexp '^alias\.'`, so git's own quoting rules apply, and for the list of git's commands. `src/aliases.js` works out what each alias calls: the first word of a plain alias, every `git <name>` in a shell alias, or the script a shell alias runs. An alias that calls git directly is 1 hop from git, and one that calls an alias is one hop further than the deepest alias it calls. `src/editor.js` writes the page with the aliases, the functions of `src/aliases.js` and the page's own script embedded, so the page analyses every draft with the same code as `stats`. [src/README.md](src/README.md) describes every module and its layer.

## Known limits

- It reads only the aliases defined in the file itself, not those of files the file includes.
- In a shell alias, it sees only calls written as `git <name>`.
- The export sorts the aliases by name and keeps only the comments directly above an alias.

## Contributing

Run the checks CI runs before opening a pull request:

```sh
npm ci
npx playwright install chromium
npm run check
```

`npx playwright install chromium` downloads the browser the editor test opens, once; with `CHROME_PATH` set to an installed Chrome, the test uses that instead.

## License

MIT. See [LICENSE](LICENSE).
