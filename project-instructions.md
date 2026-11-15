Repository tiavelum/git-alias-map.

A public tool that shows how the git aliases of a gitconfig, kept in a separate private repository, call each other, and writes an editor page for reducing them.

- The repository holds no personal data: never commit a real gitconfig, any other file from the user's private config, or a page or output generated from it. Tests and examples use invented data.
- A change is done when `npm run check` passes. Run it; if you cannot, wait for the CI run of your commit and report its result.
