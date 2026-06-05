# ADR-005: Curator-side data transformation; deploy stays build-free

- **Status:** Accepted
- **Date:** 2026-06-05
- **Issue:** [#93](https://github.com/Johnesco/karaokedirectory/issues/93)
- **Supersedes:** None
- **Amends:** [ADR-002](002-vanilla-js-no-build.md) (clarifies scope: "no build step" applies to the deploy pipeline, not curator-side data prep)

## Context

The curator needs to track per-venue private metadata — source URL, contact info, last-verified date, free-text notes — for venue and KJ-show provenance. Three constraints:

1. **No leak risk.** Private fields must never reach the public repo, the deployed site, or any visitor's browser.
2. **No duplication of public data.** Maintaining two parallel files (public + private) keyed by name leads to drift and "lost track of what corresponds to what" — a problem the user explicitly raised during planning.
3. **Honor ADR-002's spirit.** The deployed site should stay free of any build pipeline between `git push` and what visitors see.

A pure overlay design (keep `js/data.js` as master, add a small annotation file) was considered and rejected because the curator's natural flow is to write source/contact info *first* when discovering a venue — splitting it across two files at write time was friction the user pushed back on.

Inverting the dependency (curator file is master, public file derived) requires a transformation step. The question: where does that step run?

## Decision

A small **Node build script** runs **on the curator's machine** (manually via `node scripts/build-public-data.js`, automatically via a git pre-commit hook installed by `scripts/install-hooks.js`). It reads a gitignored master at `_curator/data.js`, deep-clones the listings while stripping every `_curatorMeta` field, validates the output strictly, and writes `js/data.js`.

The deployed site loads `js/data.js` exactly as before. **Nothing changes between `git push` and what visitors see** — the static files in `main` are served as-is by GitHub Pages. The build step is a developer-side transformation, not a deploy-side one. ADR-002's spirit is preserved.

`editor.html` auto-detects which file is loaded: if `_curator/data.js` is present (`window.curatorMasterData` defined), it enters Master mode with curator-fields visible; otherwise it falls back to Public mode and behaves identically to today. The public deploy has no master, so it's always Public mode there.

A read-only dashboard at `_curator/index.html` renders the master in a plain table view for quick lookup — deliberately not styled to match the public app.

## Consequences

**Positive**
- **Single source of truth for the curator.** They write everything in one place; the public file is generated.
- **Strict validation refuses to leak.** The build script's safety check (`if serialized output contains "_curatorMeta", refuse to write`) is a hard structural guarantee, not procedural discipline.
- **Pre-commit hook closes the "forgot to build" trap.** Edits to the master trigger an automatic rebuild + stage of `js/data.js` at commit time.
- **No npm runtime dependencies.** The build script uses only Node's standard library (`fs`, `path`, `child_process`). No `package.json` required (it's gitignored anyway per ADR-002), no lockfile, no Dependabot churn.
- **Existing `editor.html` workflow preserved.** On the public site it behaves identically to today. The mode switch is invisible to anyone not curating.
- **Reversible.** If we ever want to abandon the master/build architecture, the master file is the union of public + private data — deleting `_curator/` and reverting the editor changes lands us back at the pre-ADR-005 state.

**Negative / accepted tradeoffs**
- **Contributors need Node installed** to run the build locally. Mitigated: the build is only needed by the curator; contributors who don't touch venue data don't need it. The deploy pipeline still doesn't need Node.
- **`js/data.js` is now a generated artifact.** It's still committed (so GitHub Pages can serve it) and still reviewable in PRs, but hand-edits to it will be clobbered by the next build. Documented in CLAUDE.md and the file header.
- **One extra file (`_curator/data.js`) lives on the curator's machine.** Loss is recoverable: every venue exists in the public `js/data.js`; only `_curatorMeta` annotations would be lost.
- **The mode switch in `editor.html` adds a small amount of conditional code** to detect which file is loaded and render accordingly.

**Future revisit triggers**
- Build script grows beyond pure stripping (e.g., schema migrations, derived fields). At that point we'd reconsider whether a "no runtime build" rule is still cost-effective.
- A second contributor regularly curates and the per-machine master becomes painful (would imply we need a shared private store).
- File System Access API support stabilizes enough to replace the paste-based editor flow.

## Options considered

### Option A — Overlay by ID (rejected)

Keep `js/data.js` as master; add `_curator/data.js` with annotations keyed by venue ID. Dashboard joins the two; editor never touches curator data. Same safety properties (curator file gitignored), no build step, no editor retrofit needed.

Rejected because the curator's natural editing flow is "discover venue → record source → record details" — all in one place. Splitting source/contact into a different file at write time was friction the user pushed back on. Overlay-by-ID would also require manually inventing show keys; the curator wanted the master to *be* the canonical record so keys are inherent.

### Option B — Curator-master + build step (accepted)

What we picked. Single editing surface, strict-validated build, automated hook to close the "forgot to run" trap.

### Option C — Runtime stripping in the public app (rejected)

Both files exist; the public app loads master if available, strips private fields client-side at boot. No build step.

Rejected because the master would have to be in a path the deployed site could load — which means committing it — which means private data in the public repo. Even if filtered before display, it's in DevTools-readable memory and in `view-source`. Defeats the leak-safety goal.

### Option D — Separate gitignored note files per venue (rejected)

`_curator/blackheart.md`, `_curator/the-tavern.md`, etc. Markdown per venue. Pure documentation, no integration with the editor or dashboard.

Rejected because the user wanted a structured view ("by venue / by KJ show") with searchable fields. Loose markdown doesn't give that.

## Implementation notes

- **Master file format:** mirrors `js/data.js` exactly — `tagDefinitions` + `listings` — with each listing optionally carrying `_curatorMeta`. Dual-export footer (`window.curatorMasterData` for the browser, `module.exports` for Node).
- **Build script:** `scripts/build-public-data.js`. Validates required public fields (`id`, `name`, `address.street`, `address.city`, non-empty `schedule`), checks all `tags[]` are known IDs, runs a final "no `_curatorMeta` in serialized output" safety check.
- **Hook:** `scripts/install-hooks.js` writes `.git/hooks/pre-commit` (a shell script that calls `node scripts/precommit.js`). One-time install per checkout.
- **Watch (optional):** `scripts/watch-master.js` re-runs the build on master save. Useful during curation sessions paired with a local dev server.
- **Editor mode detection:** `editor.js` prefers `window.curatorMasterData` over `window.karaokeData` at boot. Mode badge in the header. Curator-fields fieldset hidden in Public mode.
- **Dashboard:** `_curator/index.html` is single-file (inline HTML+CSS+JS), no external CSS or modules, deliberately plain styling.

## Reaffirms / clarifies ADR-002

ADR-002 said "no build step." This ADR clarifies that the scope of that rule is the **deploy pipeline** — what runs between `git push` and what visitors see. A developer-side transformation that runs before commit (and produces the same committed artifacts that have always been committed) is not what ADR-002 was guarding against. The properties ADR-002 was protecting — forever-readable code, zero supply-chain surface area for the deployed site, no framework churn, debuggable runtime — all still hold.
