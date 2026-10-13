# Spike: Group a day's shows into sections

> **Status:** Analysis complete. Prototype live behind `?sections=1`. Awaiting owner review.
> **Date:** 2026-10-12
> **Type:** Spike (research and prototype)
> **Ticket:** #320
> **Related milestone:** Weekly Calendar View
> **Draft decision:** [ADR-017](../adr/017-day-card-sections-and-featured-placement.md) (Proposed)

## The question

Today a day card is one list: specials first, then A–Z. Should it be grouped
into sections, and what does each section's rule need to be?

## What the owner decided (2026-10-12)

| Order | Section | Heading | Rule |
|---|---|---|---|
| — | Specials | none | `frequency: "once"`. Pinned on top, as today. |
| 1 | **New** | "New" | The show **or its venue** is new within a rolling 30 days. A new show at an established venue qualifies on its own (only its rows do). The window starts at the **later of `created` and the first night** (`activePeriod.start`). |
| 2 | **Featured** | "Featured" | A flag on the show. Test placements only for now; the label is revisited when the slot opens for business. |
| 3 | **Verified** | "Verified" | `lastVerified` within a rolling 30 days. A confirmation for a night still ahead counts. |
| 4 | The rest | none | Everything else. Always last. |

- **Both 30-day windows count back from today**, not from the card's date, so every card shows the same split.
- **Alphabetical inside every section.** Position within a section is never a rank.
- **`?fresh=1` is unchanged.** It will later grow into more detailed debug info.
- **Featured knowingly breaks Display Philosophy #1.** The directory is moving toward monetizable actions. ADR-017 records this.

## The prototype

Open the site with `?sections=1`. Add `&featured=<venue-id>,<venue-id>` to see
the Featured section; nothing in the data carries the flag yet. For example:
`/?sections=1&featured=egos,topspin-austin`.

| File | Role |
|---|---|
| `js/utils/sections.js` | Pure classifier: `newSince`, `isNewShow`, `isFeaturedShow`, `isVerifiedShow`, `sectionOf`, `groupShows`. |
| `js/components/DayCard.js` | `renderEvents()` hands off to `renderSections()` when the lens is on. Each section reuses the existing card list. |
| `js/core/router.js` | Reads `sections` and `featured` from the query string. URL-only, like `fresh`. |
| `css/views.css` | Section title and the rule that starts the unnamed remainder. |
| `test/sections.test.mjs` | Unit tests for every rule above. |

Without the flag the page is unchanged: no section markup, and the same 252
cards on the default calendar.

**How it slots in.** `getVenueEventsForDate()` already emits one row per show,
sorted specials-first then A–Z (ADR-013). `groupShows()` buckets those rows in
order, so each section inherits alphabetical order with no sort of its own, and
specials keep their pinned slot by being a bucket. A show lands in exactly one
section, the first it qualifies for, so the footer's venue count needs no
change.

## What the real data gives

Current `js/data.json`, counted from today (Mon Oct 12). Nothing is featured,
and only `activePeriod.start` can make a show New, because no `created` field exists yet:

| Day | Specials | New | Featured | Verified | Rest | Total |
|---|---|---|---|---|---|---|
| Sun Oct 11 | 0 | 0 | 0 | 1 | 15 | 16 |
| Mon Oct 12 | 0 | 1 | 0 | 0 | 9 | 10 |
| Tue Oct 13 | 0 | 0 | 0 | 3 | 14 | 17 |
| Wed Oct 14 | 0 | 0 | 0 | 2 | 21 | 23 |
| Thu Oct 15 | 0 | 1 | 0 | 2 | 19 | 22 |
| Fri Oct 16 | 0 | 0 | 0 | 2 | 17 | 19 |
| Sat Oct 17 | 0 | 0 | 0 | 1 | 14 | 15 |
| Sun Oct 18 | 0 | 0 | 0 | 1 | 15 | 16 |
| Mon Oct 19 | 0 | 1 | 0 | 1 | 9 | 11 |
| Tue Oct 20 | 0 | 0 | 0 | 3 | 14 | 17 |
| Wed Oct 21 | 0 | 0 | 0 | 2 | 22 | 24 |
| Thu Oct 22 | 0 | 1 | 0 | 2 | 19 | 22 |
| Fri Oct 23 | 0 | 0 | 0 | 2 | 18 | 20 |
| Sat Oct 24 | 0 | 0 | 0 | 1 | 15 | 16 |

- **New:** Lava Java Lounge (Mondays) and Millie's on Main (Thursdays). Both come from `activePeriod.start`.
- **Verified:** about 10% of a night. These are Wicked Wings, Alcove Cantina, Oilcan Harry's, The Whiskey Room, The Fieldhouse at the Crossover, Moonlight, Big Shotz, Hudson Tavern and Homespun. Millie's on Main is confirmed too, but New outranks Verified.
- **The rest:** 85–90% of every night. With no heading, it reads as "the regular schedule", which is what it is.

### Finding: New and Verified are mostly the same shows

Git history shows what was added in the last 30 days (`js/data.json` on Sep 11 vs today):

- **New venues:** Alcove Cantina, Wicked Wings, American Legion Post 83, Oilcan Harry's, Lava Java Lounge
- **New or changed shows at existing venues:** Millie's on Main (Thursday 19:00), Hudson Tavern Lynum (Friday 19:00)

Four of those five venues are on the Verified list above. That's expected: the
poster pipeline is how new shows get found, so a new show arrives with its
first confirmation attached. Once `created` exists, **New will take most of
Verified's current members for their first 30 days**, and Verified will mostly
hold shows that have stayed confirmed after they stopped being new. The order
in the table above already handles this. It's just worth knowing that Verified
will look thin for a month after launch.

## Answers to the open questions

### 1. The `created` field

**Recommendation.** Add `created: "YYYY-MM-DD"` on the **venue** and on each
**schedule entry**. Export it to `js/data.json` and enforce it in the schema.

- **Who stamps it.** The curator, on the day a venue or show is added. Nobody types it.
- **Split (ADR-016).** The new half carries the old show's `created` forward. A time change isn't news. The Split dialog gets a "this is a new show" checkbox for the rare split that is one.
- **Validator.** Error if `created` is malformed. Warn if it's after `activePeriod.end`. No rule against future dates: CI runs on other days than the curator.
- **One-time specials** don't need it. They're pinned above New and never reach the New rule.

**Existing listings: reconstruct the last 30 days once, from git, then never
again.** "Never backfill" exists to stop the data from inventing history. Git
isn't invention; it is the audit log (functional spec §11). Only the last 30
days matter, because an older `created` would be outside the window anyway.
That means the reconstruction is the seven rows listed above and nothing else.
Every older venue and show stays undated, which costs nothing, because undated
just means "not new". Without the reconstruction, New would launch empty and
fill one show at a time.

The two changed shows need the owner's eye before stamping:
Hudson Tavern Lynum's Friday and Millie's Thursday could be time changes rather than new nights.

**Created vs. first night (decided).** The window starts at the later of the
two, so a show added three weeks before its first night gets its full 30 days
from that night. `newSince()` implements this, and the tests cover both orders.

### 2. Featured as data

**Recommendation.** `featured: { start?, end? }` on the **schedule entry**:
inclusive and either end open, the same shape as `activePeriod`.

- **It's on the show, not the venue,** because the show is the unit (ADR-013), and a placement is sold for a night or a run of nights, not for a building.
- **The window is tested against the card's date,** not today. The two 30-day windows describe the data's age. A placement describes which nights carry the slot. That makes it the one date in this feature that's about the card.
- **A dated window ends on its own**, so there's nothing to remember to clear. Accept `true` as well for the test phase.
- **Validator.** `end` ≥ `start`; warn on a window entirely in the past (the same shape as the ADR-016 prune warning); not allowed on `once` entries, which are already pinned.
- **Curator.** A Featured panel beside the lifespan panel on each schedule row.

**Disclosure is deferred, but gated.** ADR-017 makes "revisit the label and
disclosure" a precondition of the first paid placement, not a nice-to-have.

### 3. Knock-on effects

| Concern | Finding |
|---|---|
| **Extended sections** (Next Week, Later in Month, Next Month) | They render through `DayCard`, so they get sections automatically, with the same split as this week because the windows count from today. The `venueIds` narrowing (#206) applies before grouping, so deduplication is unaffected. **Recommend keeping it.** |
| **Search, dedicated filter** | Filtering happens before grouping. Sections shrink or vanish with the results, and empty sections are dropped. Nothing to add. |
| **Footer venue count** | Unchanged: a show sits in exactly one section. |
| **Exclusions** | An excluded night keeps its row and its banner inside whichever section the show belongs to. Its *section* is a fact about the show, not that night. Acceptable. |
| **Display Philosophy #5** (balance daily regulars against rarer shows) | The 30-day Verified window keeps monthly shows in Verified between posters. Homespun's third Monday (confirmed Oct 19) shows on Oct 19's card. Daily venues don't gain anything from sections. |
| **Phones (≤768px)** | Each heading costs about 34px: a 16px title, 4px under it, and 14px between sections. With all three headings plus the remainder's rule, the first remaining card drops about 100px. On a 812px screen that's less than one card. |
| **Desktop (769px+)** | Each section starts its own grid, so a one-card section leaves the rest of its row empty. That reads as intended separation. Merging partial rows would hide where a section ends. **Recommend keeping it.** |
| **`?fresh=1`** | Untouched, and it composes: the lens annotates cards inside sections. |
| **`?debug=1`** | Worth adding later: a line on each card saying *why* it's in its section ("New since Oct 1", "Verified for Oct 15"). Out of scope here; it fits the "fresh grows into debug info" direction. |

## Recommendation

Adopt sections as specified. The prototype needs only one data field the
directory doesn't have (`created`) plus the new `featured` flag. The
grouping fits in one pure module and one render method, and every existing
filter and count keeps working unchanged.

**Proposed follow-up tickets** (to file once the owner accepts this write-up):

1. **Schema: `created` and `featured`** on the venue and schedule entry, plus validator rules and the one-time git reconstruction of the last 30 days.
2. **Curator:** stamp `created` on add, carry it through Split with a "new show" checkbox, and add the Featured panel.
3. **View:** promote the prototype from `?sections=1` to the default. Drop the `?featured=` stand-in. Add e2e coverage for section order, empty sections, search and the footer count. Update the functional spec §2 and CLAUDE.md's Display Philosophy (per ADR-017).
4. **Later:** `?debug=1` shows each card's section reason.
