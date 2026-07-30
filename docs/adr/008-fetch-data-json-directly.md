# ADR-008: Browser fetches `js/data.json` — remove the generated `js/data.js` wrapper

**Status:** Accepted
**Date:** 2026-07-29
**Issue:** [#126](https://github.com/Johnesco/karaokedirectory/issues/126)
**Related:** [ADR-002](002-vanilla-js-no-build.md) (no build step) · [ADR-003](003-github-pages-deploy.md) (GitHub Pages) · [ADR-006](006-data-json-canonical.md) (data.json canonical)
**Amends:** ADR-006 — removes the JS wrapper it deliberately kept, and retires the build-step carve-out it added to ADR-002.

## Context

ADR-006 made `js/data.json` canonical and reduced `js/data.js` to a generated one-line wrapper. It kept the wrapper for a single reason: `<script src="js/data.js">` sets `window.karaokeData` **synchronously**, and two pages depended on that global existing before their code ran. That ADR named "browser fetches `data.json` at runtime" as the cleanest long-term option and explicitly deferred it — the refactor was out of scope, and the CI sync gate was judged sufficient protection ("annoying but not data-corrupting").

Two things have changed since.

**The consumer count collapsed.** All four dev scripts (`validate-data.js`, `geocode-venues.js`, `audit-for-supabase.js`, `seed-from-data.js`) now read `data.json` directly. The generated file has exactly two consumers left: `index.html` (via `app.js`'s already-async `loadData()`, where it is merely fallback #3) and `submit.html` (which reads **only** `karaokeData.tagDefinitions`, downloading ~73 KB of venue listings to render about thirteen tag checkboxes).

**The deferred cost came due.** Issue #125: `data.json` sat untouched from June 13 while `data.js` was written July 25, and three live venues — `austin-deaf-club`, `crow-bar`, `wanderlust-wine-shady` — plus Hard Count's `active: false` exist **only in the generated artifact**. The CI gate reported the divergence but nothing forced a resolution, so the derived file became the newer truth. That inverts the entire point of ADR-006, and the obvious remedy (`sync-data-js.js`) would have deleted three venues. "Not data-corrupting" turned out to be optimistic: two files that can disagree eventually do.

## Decision

The browser fetches `js/data.json` at runtime. `js/data.js` and `scripts/sync-data-js.js` are deleted, along with the CI sync step.

- `app.js` `loadData()` is already an async function with a Supabase branch; the local source becomes a `fetch('js/data.json')` branch. The `karaokeData` global and dynamic-import fallbacks go away.
- `submit.html`'s `populateTagCheckboxes()` becomes async and caches the definitions that `getUserSelectableTagIds()` needs at submit time.
- `geocode-venues.js` drops its post-write sync call — it patches `data.json` and stops.

This restores ADR-002 in full: with no derived data artifact, the narrow "scripts that derive a data artifact from another data artifact" carve-out has nothing left to cover. Files are once again served exactly as they sit in the repo, which is also what ADR-003 assumes of GitHub Pages.

## Consequences

### Positive

- **The drift bug class becomes structurally impossible.** One file cannot disagree with itself. #125 is the last of its kind.
- One less CI gate, one less script, and one less step for the external curator, which currently runs a second command after every edit.
- `submit.html` stops downloading the venue database to draw checkboxes.
- Venue data stops being a render-blocking `<script>` in `index.html`.
- #124 Phase 2 (host normalization migration) simplifies — it rewrites one file instead of a file plus a regenerated artifact.

### Negative

- **Opening `index.html` directly from disk stops working.** `fetch()` is blocked by CORS on `file://` origins where `<script src>` is not. The README documents `python -m http.server` / `npx serve`, `.claude/launch.json` uses a server, and nothing in the repo references `file://` — but anyone in the habit of double-clicking the file loses it.
- One network round trip before first render, where the data previously arrived with the document. Small, and partly offset by no longer blocking on a 73 KB script.
- **#125 must be resolved first.** `data.js` is currently the only copy of three venues; deleting it beforehand loses them.
- Comments across `supabase.js`, `config.js`, `venues.js`, and the schema description still describe "the `data.js` shape" and need a sweep, as does user-facing copy in `KJDossierView` that tells KJs to check `js/data.js`.

## Alternatives considered

- **Keep the wrapper, add a pre-commit hook that runs sync.** Lowers the odds of drift without removing the class, and the curator lives outside this repo (`~/karaoke-curator/`), so repo hooks would not fire for the tool that actually writes the data — precisely the path that produced #125.
- **Make `data.js` canonical again and generate `data.json` from it.** Reverses ADR-006: loses `$schema` autocomplete (which only works on the edited file) and brings back regex-parsing the JS in every dev script. Already rejected once.
- **Embed the data as `<script type="application/json">` in the HTML.** Avoids the wrapper and keeps synchronous access, but moves venue storage into markup — rejected in ADR-006 and no more attractive now.
- **Generate `data.js` at deploy time only.** Keeps the runtime as-is and stops committing the artifact, but adds a deploy pipeline to a project that deliberately has none (ADR-003 serves the repo as-is).

## Related work

- **#125** — reconcile the diverged files; **must land before this ticket**
- **#124** — host registry normalization; Phase 2 migrates `data.json` and benefits from landing after this
- **ADR-006** — the decision this amends; its "why keep a JS wrapper at all?" rationale is now retired
