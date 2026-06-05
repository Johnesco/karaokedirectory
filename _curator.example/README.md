# Curator Dashboard

This folder is the **template** for the curator's private workspace. The real instance lives at `_curator/` (gitignored), which you create by copying this folder.

## What it does

You edit one file — `_curator/data.js` — which contains every venue plus any private notes you want to attach (source URL, contact info, last-verified date, free-text notes). A small Node script reads it, strips the private fields, and writes the public `js/data.js`. A git pre-commit hook runs the build automatically so you can't forget.

Your private notes never reach the public repo. `_curator/` is gitignored as a folder; you'd need `git add -f` to commit anything in it.

## One-time setup

Two steps. The first creates `_curator/data.js` (your authoritative master) by transforming the current public `js/data.js`. The second wires up the pre-commit hook that runs the build for you.

```
node scripts/bootstrap-curator.js
node scripts/install-hooks.js
```

That's it. After this, `js/data.js` becomes a generated artifact — you never edit it by hand again. The `_curator.example/` folder you're reading is no longer involved; the live workspace is `_curator/`.

Smoke test the build (optional, just to confirm):

```
node scripts/build-public-data.js
```

This should report "up to date" — the bootstrap leaves the master in a state where the next build produces no changes.

## Day-to-day cycle

1. Edit master via `editor.html` (it auto-detects Master mode when `_curator/data.js` is present and shows a curator-notes fieldset) or by opening `_curator/data.js` in a text editor.
2. Save. If you have `node scripts/watch-master.js` running, the rebuild happens automatically; otherwise run `node scripts/build-public-data.js`.
3. Reload `http://localhost:8000/index.html` (your dev server) to preview the public app with the fresh data.
4. When it looks right, `git commit`. The pre-commit hook re-runs the build and stages `js/data.js` for you.
5. `git push`.

## The dashboard

Open `_curator/index.html` in your browser (double-click works — it runs over `file://` with no server needed). You'll see a plain table view of every venue and every show, including your private notes. Use it to scan coverage, spot venues that need sources, and find contacts quickly.

The dashboard is read-only. Edits happen in `editor.html`.

## Files in this folder

- **`data.js`** — the master template. After copying, this becomes your authoritative venue data with private annotations.
- **`index.html`** — the dashboard (data-table view of everything).
- **`README.md`** — this file.

## Why this is safe

- `/_curator/` is in `.gitignore` — your private notes never enter the repo.
- The build script validates strictly: if any `_curatorMeta` would survive into `js/data.js`, the build refuses to write.
- The pre-commit hook re-runs the build before every commit, so a forgotten manual step can't lag the live site.
- The editor on the deployed public site has no `_curator/data.js` to load, so it lands in Public mode with curator fields hidden — same behavior as before this folder existed.

See `docs/adr/005-curator-master-build-step.md` for the architectural rationale.
