# ADR-019: Venue data deploys from its own branch

**Status:** Proposed
**Date:** 2026-10-14
**Amends:** [ADR-010](010-static-on-netlify-only-constraint.md) (the deploy model; the static-on-Netlify constraint stands), [ADR-012](012-generated-entity-pages.md) (the build's input), and the data-by-pull-request route of #277
**Tickets:** #337 (the move), #331, #334, #336
**Related:** [ADR-018](018-curator-keeps-current-state.md) (the curator keeps current state only; one writer)

## Context

Today `js/data.json` lives on `main` beside the code. `main` is protected:
every change needs a PR and two green checks, and that applies to admins too.
So every curator publish is a pull request, several times a week, and each one
waits for CI and a merge before going live. Code PRs could also change the data
(#322 did), which is what produced the drift machinery ADR-018 retires.

The owner wants publishing to be **"test it hard locally, then push"**. They
also expect the data to move to a real database once it outgrows a file.

Pushing data straight to `main` would mean turning off its protection for
everything, code included.

## Decision

1. **The data lives on its own branch, `data`,** which holds only
   `js/data.json`. It is not protected by PR rules. `main` no longer contains
   the file, and `js/data.json` is gitignored there.
2. **The build pulls the data.** Netlify's build runs `npm run data:pull`
   before `npm run build`. Local dev, CI and the e2e suite run the same
   command. The pull reads the tip of `data` through git (or the GitHub API),
   **not** `raw.githubusercontent.com`, whose CDN can serve a stale copy for
   minutes after a push.
3. **A push to `data` deploys.** A GitHub Action on `data` calls a Netlify
   build hook, whose URL is a repo secret. Pushes to `main` deploy as they do
   now.
4. **Publishing is local gates, then a push,** run by the curator (#334) in a
   dedicated copy of the site inside the curator folder, never a developer
   checkout:
   - `validate-data`;
   - the entity-page build;
   - the full e2e suite;
   - a render pass over the pages that fails on console errors.

   Then one commit is pushed to `data`, with the change summary as its
   message. Nothing is pushed if any gate fails. **Undo** pushes the previous
   version back.
5. **One writer.** Only the curator pushes to `data` (ADR-018). Code branches
   don't contain the data file, so a code PR can't change it.

## Consequences

- **Good.** Publishing takes minutes instead of waiting for a PR's CI and
  merge, and `main` keeps its full protection for code.
- **Good.** The build step becomes the **data-source seam**. "Get the data" is
  one script. When the directory moves to a database, that script reads a
  database export or an API instead of a branch. Nothing else changes, and
  ADR-010's static output still holds.
- **Good.** Data history is its own timeline (`git log data`): one commit per
  publish, each carrying its summary.
- **Cost.** There is no review between the owner and the live site; only the
  local gates. A bad publish is live until Undo. The gates are the same ones
  CI runs today, so CI becomes a second line for code, not for data.
- **Cost.** Every checkout, CI job and deploy needs a pull step, and a fresh
  clone has no data until `npm run data:pull` runs.
- **Cost.** One manual setup step outside the repo: create the Netlify build
  hook and store it as a repo secret.
- **Cost.** Data and code can disagree for a while. If a schema change lands
  on `main` before any data uses it, nothing breaks, because the schema only
  allows more. If data needs a schema that `main` doesn't have yet, the local
  gates catch it: they validate against the schema of the site version being
  deployed. So the order is code first, then data, as ADR-018 already says.

## Alternatives considered

- **Let the owner push data straight to `main`** (turn off "include
  administrators"). Rejected: it removes protection from code too, mixes data
  into code history, and leaves "one writer" as a habit rather than a
  structure.
- **Keep data PRs, and speed them up** (auto-merge on green). Rejected: it
  still waits on CI, and it keeps data in code history and in code PRs' reach.
- **A separate data repository.** Workable, and a natural next step if access
  ever needs to differ. Rejected for now: a branch gives the same separation
  with one less repository to manage.
