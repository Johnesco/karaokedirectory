# ADR-016: A show's lifespan, recorded as it becomes known

**Status:** Accepted
**Date:** 2026-09-26
**Tickets:** #288
**Related:** [ADR-013](013-show-centric-presentation.md) (the show is the unit of presentation) · [ADR-015](015-one-confirmation-per-show-date.md) (a date means the night it is about) · #169 (the 30-day grace for spent one-time events)

## Context

A recurring schedule entry has no life of its own. `scheduleMatchesDate()`
matches a day-of-week pattern, so a show added a year ago runs, as far as the
site can tell, forever in both directions. Time bounds exist only above and
below the show: a venue's `activePeriod` (3 of 81 venues) bounds the whole
venue, and `exclusions` (2 of 147 entries) skip single nights.

That holds until a change becomes known before it happens. On Sep 26 we learn
that a show moves from Tuesdays to Thursdays on Oct 15. The calendar looks up
to ~60 days ahead (Next Week, Later in Month, Next Month), so whichever version
sits in `data.json` is wrong for part of the window: the old one lists Tuesdays
after Oct 14, the new one lists Thursdays this week. The only way to be right is
to edit the file on the day, which turns a fact known three weeks early into a
chore with a deadline. The same shape covers a KJ leaving at the end of the
month, a new show whose first night is next Friday, and a show that simply
stops.

Three things are **not** the problem, and this ADR does not solve them:

- **History.** No surface shows what a venue used to do, and Display
  Philosophy §7 rules out a public archive. Git already records every published
  version of the file.
- **Interruptions.** A holiday or a temporary closing is a gap *inside* a
  show's life. `exclusions` handle it and stay as they are.
- **Corrections.** A time that was wrong all along is fixed in place. The show
  did not change on a date; our data did.

## Decision

**A schedule entry may carry its own `activePeriod`: the known start and end of
that show's life, filled in as each becomes known.**

```jsonc
{ "frequency": "every", "day": "Tuesday", "startTime": "21:00",
  "activePeriod": { "end": "2026-10-14" } },
{ "frequency": "every", "day": "Thursday", "startTime": "21:00",
  "activePeriod": { "start": "2026-10-15" } }
```

**1. Same name and shape as the venue-level field.** One concept at two levels:
the window during which the thing exists. `isDateInRange()` already evaluates
it. At entry level either bound may appear alone, and at least one is required;
a missing bound is open. It is not allowed on `once` entries, whose date is
already their whole life. The venue-level definition is unchanged.

**2. Both bounds are optional, and neither is ever backfilled.** An entry
without `start` means "running since before we knew", which is the honest
reading of every one of today's 135 recurring entries. The date an entry was
*added* is not the date the show *started*; writing one as the other is the
seen-date/show-date conflation ADR-015 removed from `lastVerified`. A bound is
written when the real-world date is known, and only then.

**3. A change is an end plus a start; a correction is an edit.** When a show
moves, changes host, or changes time on a date, the old entry gets `end` (the
day before) and a new entry opens with `start`. When a fact was simply wrong, it
is edited in place with no dates. The curator makes the change path an action
of its own (pick the entry, give one date, it performs the split), so the
distinction costs one decision rather than bookkeeping. A plain edit stays a
correction by default.

**4. No announcement.** The switch simply happens on its date. Nothing public
says "moving to Thursdays" or "starting Oct 15". Surfaces that ask about a
specific date answer for that date; surfaces that ask about no date answer for
today:

| Surface | Asks about | Shows |
|---|---|---|
| Weekly calendar, extended sections, map date filter, `nextOccurrence()`, `lastOccurrenceOnOrBefore()` | a specific date | entries whose window includes that date |
| Detail schedule table (modal and pane), A–Z, map card, KJ index and dossier, search, generated pages | no date | entries current today |

This is how venue-level `activePeriod` already behaves (`venuePasses()` checks
the calendar's date, `getVenuesSorted()` checks today), so the entry level adds
no new rule, only a second place it applies.

"Current today" is `activeEntries()`: the entries whose window includes today.
A `once` entry carries no window and always passes; the surfaces that already
dropped spent one-time events (the map card, the "Also" line) still do so with
`isPastOnceEvent()`, and the others are unchanged for them. A future recurring
row is hidden because "Every Thursday" with no date reads as *now*, and
labelling it would be the announcement this decision declines.

**5. Ended entries are removed 30 days after `end`.** We keep no history of
shows, in the public file or in the curator master. For 30 days an ended entry
still renders on the past dates that can still be viewed (this week's collapsed
days, a week navigated back); after that it is deleted, and git holds what was
published. Thirty days is the grace a spent `once` entry already gets (#169),
and an ended recurring show is the same situation. `validate-data.js` warns
rather than fails past that point, for the reason #169 gives: a date-driven
failure would turn CI red on a day nothing changed, and removing rows is
curation.

**6. A new entry is a new show.** The replacement gets a fresh curator `_id`,
so announcements and the derived `lastVerified` do not carry across. That is
correct: the Thursday schedule is unconfirmed until something confirms it. No
lineage link is kept between the two. Announcement records that pointed at a
pruned entry become unlinked, which the `_announcements` shape already allows.

### The cost we are accepting

**Detail and calendar can disagree during the lookahead.** On Sep 26 the
calendar's Next Month section shows the Thursday Oct 15 show at that venue; open
its details and the schedule table says Tuesday, because Tuesday is what is
current today. The card itself names the right night, and the disagreement ends
on the switch date. A date-aware detail view would close it, but
`VENUE_SELECTED` carries a venue and not a date, and threading one through
touches every entry point. Accepted as the price of not announcing.

**Generated pages lag a switch by up to one build.** The `/venue/`, `/kj/` and
`/company/` pages evaluate "today" at build time, as `eventNodes()` already does
for one-time events. A switch appears at the first deploy on or after its date.
Data publishes happen several times a week, which bounds the lag, and the
JSON-LD stays correct regardless (see Consequences).

## Alternatives considered

**Edit on the day (the status quo).** Rejected: it needs the curator to act on a
specific date, and until they do, either the past or the lookahead is wrong.

**Require `start` on every entry (full versioning).** Rejected: 135 entries would
need a date nobody knows, and any date written would be the date added, which is
a different fact. An optional bound says exactly what is known.

**Keep ended entries, publicly or only in the curator master.** Rejected.
Publicly: the file is not an archive (Display Philosophy §7), and every surface
would need a filter for rows it can never show. Master only: two lists that
differ by design, a drift check that has to reproduce the pruning rule, and no
reader for the history. Git already has it.

**End a show with exclusions.** Rejected as unbounded: one exclusion per future
night, forever. Exclusions interrupt a life; they do not end one.

**Split the venue instead**, with a venue-level `activePeriod` on a copy.
Rejected: the venue outlives its shows (ADR-013 §1). Its address, tags and links
do not change when a KJ does.

**Announce the change** ("Moving to Thursdays from Oct 15"). Declined. It would
mirror the upcoming-exclusion notice, but it describes the data's future rather
than the venue as it is, and the calendar is right without it.

**New field names** (`from`/`until`, `effective`). Rejected in favour of the
existing `activePeriod`: one idea should have one name, and the helper and the
schema definition already exist.

## Consequences

- `scheduleMatchesDate()` gains the window check. It is the single choke point,
  so the calendar, the extended sections, the map's `venueHasShowInRange()`,
  `nextOccurrence()`, `lastOccurrenceOnOrBefore()` and the validator's "not a
  night this show runs" check for `lastVerified` all inherit it with no further
  change. A confirmation for a night after a show's end is reported by a check
  that already exists.
- `isActiveOn()` answers for venues and shows alike, and `activeEntries()` is
  the date-less rule. The detail schedule table, the host section, the KJ views
  and `venueMatchesSearch()` gain a filter they have never had, so an ended
  show's host stops matching search. The "Also" line on a calendar card reads
  other shows as of the card's own date rather than today. Nothing changes for
  an entry without a window, so the data as it stands renders exactly as before.
- Debug mode (`?debug=1`) appends the window to a card's match reason
  ("Every Tuesday · until 2026-10-14"), so a switch can be checked by eye
  without the public page saying it is coming.
- JSON-LD `Schedule` bounds become the intersection of the venue's and the
  entry's windows. A current show with a known end carries `endDate`, so search
  engines stop at the right night even if no deploy happens, which is the rot
  `scheduleNode()` exists to prevent. Entries not current at build time get no
  event node, matching the visible page.
- `validate-data.js` gains: `start` after `end` (fail, at both levels);
  `activePeriod` on a `once` entry, or an empty one (schema); an `end` more than
  30 days past (warn: prune it); an exclusion outside its entry's window (warn:
  it can never apply); two recurring entries at one venue with the same
  frequency and day whose windows overlap (warn: a change that did not end the
  old entry — the exclusion constraint a table would carry); and an active
  venue with nothing running today but a show starting later (warn: its
  schedule lists nothing until then). The "active venue with no upcoming
  events" check stops counting ended recurring entries, and the
  stale-confirmation warning skips them.
- The curator gains the change action and the 30-day prune. Because the prune
  removes the entry from the master itself, the export and the master never
  differ by it, and `check-curator-drift.js` needs no rule for it. This is work
  outside the repo, tracked on #288.
- **`data.json` stands in for a database until it converts to one.** The owner
  intends that conversion (to a relational or otherwise more fitting store);
  until then the JSON is shaped so it maps cleanly. The schema is the column
  types, `validate-data.js` the constraints, git the audit log. On conversion
  the window becomes a date-range column on the show row, the overlap warning
  becomes an exclusion constraint, and git's role as history passes to an audit
  table. The public shape does not change. A write path (ADR-009's trigger) is
  also where a lineage link between versions would start to earn its keep.

### Deferred, with triggers

- **Date-range exclusions.** A temporary closing is one exclusion per missed
  night. Trigger: a closing long enough (a nightly show dark for weeks) that
  listing the nights becomes the friction.
- **A date-aware detail view**, to close the lookahead disagreement. Trigger: a
  reader confused by it.
- **A scheduled rebuild** of the generated pages. Trigger: a switch visibly
  lagging on one because no publish followed it. The output stays static, so it
  sits within ADR-010.
- **Lineage between versions** (`supersedes`). Trigger: a need to say a show
  *moved*, or to carry a confirmation across a change.
