# ADR-013: Venue-rooted storage, registry identity, show-centric presentation

**Status:** Accepted
**Date:** 2026-08-28
**Issue:** [#245](https://github.com/Johnesco/karaokedirectory/issues/245)
**Related:** [ADR-007](007-host-registry-normalization.md) (the KJ↔company link lives on the show) · [ADR-011](011-entity-link-contract.md) (identity is `{type, id}` over registries) · [ADR-009](009-park-supabase.md) (the pattern of a written re-entry trigger) · [#222](https://github.com/Johnesco/karaokedirectory/issues/222) (executes this direction's link work) · [#246](https://github.com/Johnesco/karaokedirectory/issues/246) (freshness metadata)

## Context

Information reaches the directory from three kinds of sources: a venue ("we run
karaoke Thursdays"), a KJ ("I'm at The Highball on the 29th"), a fan ("Story-Oke
is doing a Rock Show"). Every one of those sentences is a statement about a
**show** — who, where, when. The venue is not the subject of any of them; it is
the most stable *coordinate* in them.

The data model is venue-rooted: `listings[]` own `schedule[]` arrays, and
everything else hangs off that. The strain between that shape and what the
sentences actually say has stopped being theoretical:

- **#223's entire bug class** existed because two surfaces assumed the venue
  owned facts that belong to shows — `VenueCard` and `renderHostSection` both
  read `venue.host`, so a venue whose hosts live on schedule entries rendered
  with no host anywhere.
- **The Highball** is a venue that owns no show identity: no venue-level host,
  seven one-time entries, each somebody else's show.
- **Story-Oke** is a show identity that owns no venue: it exists as a
  `companies` registry entry plus an `eventName` string prefix repeated across
  three entries at whatever venue hosts it next.
- The service layer already derives the right thing and documents it —
  `getVenueEventsForDate` returns "one row per **show**"
  (`js/services/venues.js:17`), and `DayCard` renders those pairs. After #230
  and #223, the calendar card's fields are name, tags, event name, time, host,
  address — all but one of them show or registry fields. The card is a show
  card in everything but name.
- [#222](https://github.com/Johnesco/karaokedirectory/issues/222) measured the
  display side: the four views are "four filters over one card," and the KJ
  dimension is a one-way street — KJ → venues works, venue → KJ does not, even
  though the id is on the rendered object. The generated static pages
  (`scripts/build-pages.js`) are better cross-linked than the SPA humans use.

The question this ADR settles: does the mismatch get fixed by changing the
storage shape, or by naming what the presentation layer already does?

## Decision

**Three layers, each with its own unit. None of them borrows another's.**

| Layer | Unit | Where it lives |
|---|---|---|
| Storage | the **venue** | `js/data.json` — curator-owned facts, nothing else |
| Identity | the **registries** | `kjs`, `companies`, `cities`, `tagDefinitions` (ADR-011) |
| Presentation | the **show** | derived `{venue, schedule entry}` — never stored |

**1. Storage stays venue-rooted.** Venues are the only entity with a physical
address; they outlive host churn and series churn. The curator edits by venue,
the export/drift pipeline (#237) is venue-shaped, and the file is fetched
statically (ADR-008/ADR-010). Re-rooting storage around shows would be a
curator rewrite and a data migration purchased with zero user-visible gain,
because the service layer already derives every show the display needs.
*Re-entry trigger, in the ADR-009 style: revisit only if the directory gains a
write path (per-show submissions or corrections), where show-level records
would earn their keep.*

**2. Identity stays in the registries.** Nothing new here — ADR-011 already
says every linkable thing is `{type, id}`. This ADR adds one clarification:
**a recurring named production (Story-Oke) is represented by its host registry
entry**, and "all Story-Oke shows" is the host lens (`?kj=story-oke-austin`),
not a new entity type.

**3. The show is the first-class unit of presentation.** The derived pair the
service layer already emits — venue, schedule entry, resolved host
(`resolveHostFor`), date context — is the thing views render, group, and link.
The calendar groups shows by day; the dossier groups them by host; A–Z groups
them by venue. New display work (per #222's Go decisions, a future `?tag=` or
`?city=` view) is a new *grouping of shows*, never a new bespoke pipeline.

**4. Multi-source disagreement is a freshness problem, not a structure
problem.** What conflicting sources need recorded is *when a fact was last
confirmed*, not a different hierarchy. Adopted separately as optional
per-schedule-entry `lastVerified` — scoped in
[#246](https://github.com/Johnesco/karaokedirectory/issues/246), display-silent
until a later ticket decides how it reads.

## Consequences

**What this enables**
- #222 executes against a recorded frame instead of re-deriving one per
  candidate. Its first Go (host name → dossier link) closes the one-way street.
- "Show card" becomes the documented reading of the calendar card; future
  card work stops treating show fields as venue decorations.
- A "tonight" surface, series pages, or city pages are groupings of the same
  derived list — no new data plumbing.

**What this costs**
- A derived show has **no stable id**, so a single show cannot be deep-linked
  or bookmarked. Accepted: nothing in the UX needs it today, and ADR-011 gives
  the pattern (`{type: 'show', id}`) if that changes. The trigger would be a
  real need to share one show rather than its venue or its host.
- Per-entry `lastVerified` puts upkeep on the curator. Accepted knowingly —
  per-entry was chosen over per-venue for precision, and the field is optional.
- The `VenueCard` class name and `.venue-card` CSS block now under-describe
  what they render. **Deliberately not renamed**: the e2e suite and spec pin
  those names as contracts, and a rename would be churn with no behavior
  change. The conceptual name lives here and in the spec.

**What this explicitly defers**
- **Series as a distinct entity type.** Today the host registry covers it.
  Trigger: a host running two concurrently active named series, or a series
  that changes hosts — either breaks the "series ≈ host entry" equivalence.
- **Provenance (`source: venue|kj|fan`).** `lastVerified` covers the operative
  need; a source field adds curator upkeep with no display consumer. Revisit if
  source conflicts become common enough to adjudicate in the UI.

## Alternatives considered

**Show-rooted storage** (a top-level `shows[]` with venue refs): the honest
version of "align the shape with the sentences." Rejected on cost — curator
rewrite, migration of 146 entries, every dev script and the drift check
re-plumbed — against no functional gain over derivation. The strain the last
month surfaced was in *presentation code reading the wrong level*, and #223
fixed that without touching storage, which is the strongest evidence derivation
suffices.

**A `series` registry now**: premature. One series exists, and it is fully
addressable through its host entry. Deferred with the trigger above rather than
rejected.

**Per-venue `lastVerified`**: cheaper to maintain, but a venue with seven
shows from three sources is exactly where per-fact freshness matters — the
coarse version answers the question this ADR exists to answer with "somewhere
on this venue, something was once confirmed."
