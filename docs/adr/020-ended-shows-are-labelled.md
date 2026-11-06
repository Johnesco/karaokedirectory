# ADR-020: An ended show is labelled "Ended" on the calendar

**Status:** Accepted
**Date:** 2026-11-05
**Tickets:** #373, #378 (amended 2026-11-05: decided per night)
**Related:** [ADR-016](016-show-lifespan.md) (a show's lifespan; this amends its §4) · [ADR-017](017-day-card-sections-and-featured-placement.md) (day-card sections) · Display Philosophy #7 (amended)

## Context

ADR-016 gave a show an `activePeriod`, and its §4 decided "no announcement":
past its last night a show simply stops appearing. Display Philosophy #7 said
the same thing more broadly: "No public archive or 'closed' label."

The first real ending exposed the cost. Diamond Karaoke's Thursday show at
Wildflower Corks & Brew (Taylor) ran its last night on Oct 29, 2026. A regular
who opens the calendar on the next Thursday finds nothing, and cannot tell
"it ended" from "the directory lost it". Display Philosophy #6 (practical
utility) argues for telling them, and #4 already treats an exception as the
signal: an excluded night is shown with a "Closed tonight" banner, not hidden.

## Decision

**1. A recurring show has ended once its last night has arrived — its
`activePeriod.end` is today or earlier — and no entry at the same venue starts
the day after.** (#378: from its last night itself, not the day after.) The second condition is the
signature of a Split (ADR-016 §3): a change on a date, which the old half's
`end` records but which is not an ending. Derived, not stored: no schema or
data change, and the curator's existing **Last night** is how a show is ended.
`hasEnded()` in `js/utils/date.js`.

**2. Every calendar card for an ended show carries one diagonal "Ended"
banner across the whole card.** Including its past nights: this week's
collapsed days and weeks navigated back. Once it has ended, every showing of it
says so. The word is "Ended", not "Closed" or "Karaoke ended". The show ended,
and the venue may well still be open, so "closed" would be a false fact
(Philosophy #2).

**3. For 14 days after the last night it keeps appearing, bannered, on the
nights it would have run** (`ENDED_GRACE_DAYS`, `isEndedNight()`), decided by
the night alone, not by today (#378): a last night entered ahead of time
banners those nights at once. Then it is
gone from future dates. `scheduleMatchesDate()` stays false on those nights,
because the show does not run. `getVenueEventsForDate()` lists them alongside.

**4. Each card answers for its own night** (#378, owner). A night after the
last night reads "Ended" (§3); a night up to and including it reads normally
until the last night arrives, then "Ended" (§1, §2). So a future ending reads
normally on the show's own nights and "Ended" on the nights after, at the same
time. `isEndedOn()` decides a card.

This replaced "nothing is shown before the end date", which left a hole: a last
night entered on a day the show does not run (Alcove Cantina, Tue/Wed shows,
end Thu Nov 5) listed nothing on the following Tuesday until the end date had
passed. Data is often entered ahead of time, and should display correctly as it
is entered. It amends ADR-016 §4 further: the nights after a known ending say
so. There is still no "ending soon" or "last night tonight" text.

**5. Ended cards sit last on the day card**, in an unheaded `ended` section
after the rest (ADR-017), alphabetical, and are not counted in the footer's
open-venue count.

**6. Calendar only.** Surfaces with no date of their own (detail schedule
table, A–Z, map, search, KJ views, generated pages) keep dropping an ended show
through `activeEntries()`.

## Consequences

- Display Philosophy #7 drops "or 'closed' label" for ended shows. There is
  still no public archive: the label lasts only as long as the show's past
  nights are viewable, and the entry is still pruned 30 days after its end
  (ADR-016 §5).
- The 14 days fit inside the 30-day prune grace, so an ended show's grace
  nights always come before it is due for removal.
- The extended sections' header counts include a grace-night venue, because
  they count venues rendered rather than venues open. That is accepted: the
  card itself says Ended.
- A Split that leaves a gap (ends on the 10th, the new show starts on the 20th)
  reads as an ending. That is accurate for the nights in between.

## Alternatives considered

**Keep ADR-016 §4 as it was.** Rejected by the owner after the first real
ending: silence looks like an omission.

**A stored `ended` flag or reason.** Rejected: the end date already says it,
and a second field could disagree with it.

**Label the detail views too.** Deferred. Every dateless surface would need to
list rows it currently drops. The calendar is where a regular looks for "their
night".
