# ADR-015: One confirmation, anchored to the show date

**Status:** Accepted
**Date:** 2026-09-11
**Supersedes:** the "Clarification (2026-09-06) — evidence level and announced occurrences" addendum to [ADR-013](013-show-centric-presentation.md)
**Tickets:** #275 (this record), #276 (curator), #277 (publish)

## Context

ADR-013 §4 adopted per-show `lastVerified`, and the 2026-09-06 addendum added an
evidence *level* on top of it: `verifiedBy` (`announcement` | `check`) and
`announcedFor` (the night an announcement referred to). Three fields, and three
rules to keep them consistent:

- a plain check demotes the level back to `check`,
- a plain check clears the announced night,
- an older flier is recorded but must not move the clock backwards.

The model was coherent. It was also more than one person processing a pile of
posters can hold. Two months of use produced five stamped shows out of 147, and
the shape of the misuse is the argument: **two of the five had a poster uploaded
and were then stamped as a plain check**, so the level said "check" while a
flier sat on disk proving otherwise. Four of five uploaded images ended up
referenced by nothing. A recurring show was left at `verifiedBy: "announcement"`
with no `announcedFor`, which renders no marker on any night — a state the
schema permits, the validator does not report, and nothing displays.

The distinction the level records also turned out not to matter to the reader.
"The venue published it" and "I phoned and they confirmed it" are the same claim
about the same night, and the site presents both identically apart from an icon.

## Decision

**A show carries one public date: `lastVerified`, meaning the show date the
latest evidence confirms.** Not the day the evidence was seen — the night it is
about. It may be in the future: a flier for Oct 1 confirms Oct 1.

`verifiedBy` and `announcedFor` are removed.

Consequences that fall out of the single field:

- **The Announced marker is a date equality.** `isAnnouncedOn(entry, date)` is
  `entry.lastVerified === toLocalISO(date)`, with no evidence level to consult,
  no second field for recurring shows, and no special case for one-time ones.
  The marker stays per occurrence rather than per entry — the same
  derive-don't-store move as the special-event star.
- **The lens reads forwards or backwards from that night**: "Announced for
  Oct 1" before it, "Verified today" on it, "Verified Sep 10 · 3d" after, and
  overdue past the 60-day horizon. `freshnessOf()` gains an `upcoming` state,
  because a night that has not arrived has not decayed.
- **A future date is ordinary, not a typo.** The validator's future-date failure
  becomes a 366-day sanity limit, and it gains a check JSON Schema cannot make:
  a date the entry does not actually run on can never render the marker.
- **The curator derives the field** from its own private records rather than
  storing it by hand: the latest confirmed night among the records pointing at
  the show. That is monotonic by construction, so "an older flier must not move
  the clock" stops being a rule anyone has to apply — an older record simply is
  not the maximum. Demotion and clearing disappear with the level they acted on.

### The cost we are accepting

A plain confirmation now produces the same public Announced line a poster does.
There is no way to record "I checked, but nobody announced it" as a weaker
public signal.

We accept it because the level was not honestly maintained (see the two
mis-stamped shows above), the reader could not act on the difference, and an
unreliable distinction is worse than none. "Someone confirmed this night" is
true in both cases, and that is what the line says.

## Alternatives considered

**Keep the level, fix the curator.** The rules were sound; the tool made them
easy to get wrong. Rejected: the same tool work is needed either way, and this
way there is nothing left to get wrong. Three fields with three ordering rules
is not a tooling problem, it is a design that only works with perfect input.

**Keep `announcedFor`, drop `verifiedBy`.** Would preserve "which night" while
losing "what kind of evidence". Rejected as a half-measure: once the level is
gone, `announcedFor` and `lastVerified` answer the same question, and keeping
both invites them to disagree.

**A `source: venue | kj | fan` field** — the provenance ADR-013 deferred, which
the 2026-09-06 addendum partly adopted as a level. Now fully deferred again, and
for the same reason as the original deferral: no display consumer needs it. The
curator keeps the wording, the link and the image privately, which is where the
provenance actually lives.

**Store the seen date as well.** Rejected for the public file: it is curator
bookkeeping, and it is already in the private records. The site has no use for
"when did John look at this".

## Consequences

- One field to write, one to read, and no ordering rules — which is what makes
  a one-button poster flow (#276) possible.
- Dates recorded under the old meaning are wrong under the new one: a stamp was
  the day the evidence was seen, which is often not a night the show runs.
  Migration moves each **back** to the latest real night on or before it, never
  forward — moving forward would assert a confirmation for a night nothing has
  confirmed. Three of the five stored dates moved.
- `lastOccurrenceOnOrBefore()` and `nextOccurrence()` join `js/utils/date.js`,
  exported so the curator can import the real schedule rules instead of copying
  them.
- The announcement history (wording, source, image) remains curator-private and
  is never exported. Where it lives inside the curator changes in #276: it
  becomes a list of its own so a poster can be captured before the show exists.
- The 30-day `announcedFor` staleness warning is gone with the field. The
  60-day freshness horizon is unchanged.
