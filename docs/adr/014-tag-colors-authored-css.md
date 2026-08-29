# ADR-014: Tag colours are authored CSS; `data.json` is purely factual

**Status:** Accepted
**Date:** 2026-08-28
**Issue:** [#238](https://github.com/Johnesco/karaokedirectory/issues/238)
**Related:** [ADR-013](013-show-centric-presentation.md) (storage layer: "curator-owned facts, nothing else") · [ADR-005](005-venue-json-schema.md) (schema as single source of truth) · [#166](https://github.com/Johnesco/karaokedirectory/issues/166) (the injected stylesheet this partially supersedes) · [#229](https://github.com/Johnesco/karaokedirectory/issues/229) (the WCAG palette these values preserve)

## Context

`js/data.json` is the curator's file: the external curator tool writes it
**verbatim** on export, and ADR-013 named it the storage layer — "curator-owned
facts, nothing else." It was not that. `tagDefinitions` carried a `color` and a
`textColor` on each of 19 tags: **38 presentation values in the facts file**,
painted into a runtime stylesheet by `initTagConfig()`.

That coupling had one narrow escape and several standing costs:

- **A stale curator export nearly reverted an accessibility fix.** #229
  rewrote the tag palette to clear WCAG AA. Seventeen days later the curator
  master still carried the old colours; an export would have silently
  reintroduced all 111 tag contrast failures with every CI gate green. It was
  caught by hand, which is what #237's drift check now exists to prevent — but
  the drift check treats master-side values as *pending changes*, so colour
  regressions read as intent, not damage.
- **Design PRs had to edit the curator's file.** #229 was a pure design change
  that landed in `js/data.json`, which meant coordinating a master migration
  for a colour tweak.
- **The runtime carried machinery CSS does not need** — colour validation
  regexes (a stylesheet has no escaping, so injected values had to be
  vetted), a style element, and injection on two pages.
- **The documented palette drifted anyway**: the functional spec's tag table
  still showed the pre-#229 colours at the time of this ADR.

The injection itself was a #166 improvement over what preceded it — two call
sites each emitting inline `style=` attributes. That reasoning still holds and
is not being reversed: the failure was colours living in *data*, not the
replacement of inline styles.

## Decision

**Tag colours are authored in `css/components.css`, keyed on
`.tag[data-tag="<id>"]`. `tagDefinitions` carries the `label` only.**

- The authored values are exactly the #229 WCAG pass — bright chips keep
  their brand colour with dark ink, deep chips keep white text darkened to
  clear 4.5:1 — with a comment requiring an axe re-run before changing any
  pair.
- `initTagConfig()` stores labels and nothing else. `buildTagStyles`, the
  colour-validation regexes, and the injected style element are deleted.
- A tag with no authored rule falls back to `.tag`'s neutral surface, exactly
  as an unknown tag always has.

### The transition is warned, not broken

A curator master that has not yet dropped the fields must not hard-fail CI on
its next export. The schema keeps `color`/`textColor` as *accepted and
documented-ignored*; `validate-data.js` **warns** when any definition still
carries them, naming the fix (strip them from the master). The master was
migrated in the same change, so the warning fires only if an old backup is
restored.

## Consequences

- `js/data.json` now contains **zero presentation values** — the ADR-013
  storage layer is what it claims to be. The curator owns the file outright,
  and no export, however stale, can revert design work again.
- Design and data stopped sharing a file: tag colour changes are CSS PRs,
  covered by the CSS tooling, with no master coordination.
- Adding a tag now touches two files (a `tagDefinitions` label in the curator,
  a colour rule in CSS) where it used to touch one. Accepted: tags are added a
  few times a year, and the second step failing safe (neutral chip) makes the
  omission visible without breaking anything.
- The curator UI may render its own tag chips uncoloured until the owner's
  tool learns the palette lives elsewhere — cosmetic, owner's tooling, out of
  this repo's scope.

## Alternatives considered

**Keep colours in data, harden the pipeline instead** — the drift check
already exists, so rely on it. Rejected: the check reports master-side colour
differences as pending edits, because from the data's point of view that is
what they are. Only removing presentation from the data makes the failure
mode impossible rather than detectable.

**Generate the CSS from data at build time** — a `build-pages.js`-style step
emitting the palette. Rejected: it keeps colours in the curator's file, which
is the actual defect; the build step would exist to preserve a coupling this
ADR exists to break.

**Return to inline `style=` attributes** — never on the table; #166's
consolidation stands. This ADR moves where the one stylesheet comes from, not
whether there is one.
