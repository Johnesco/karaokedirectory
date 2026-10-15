# ADR-017: Day-card sections, and featured placement

**Status:** Accepted (2026-10-15, shipped in #324)
**Date:** 2026-10-12
**Tickets:** #320 (spike)
**Related:** [ADR-013](013-show-centric-presentation.md) (the show is the unit of presentation) · [ADR-015](015-one-confirmation-per-show-date.md) (`lastVerified` is the night confirmed) · [ADR-016](016-show-lifespan.md) (`activePeriod` on the show) · [spike write-up](../spikes/day-card-sections.md)

## Context

A day card lists its shows as one flat list: specials first, then A–Z. Every
show is presented the same way, which is what Display Philosophy #1 asks for:
"Neutral Directory, Not a Review Platform … No algorithmic or editorial
favoritism."

Two things have changed:

- **Confirmations are now frequent.** The poster pipeline (#276, #300–#306) stamps `lastVerified` several times a week. Whether a show has been confirmed recently is now a fact worth showing.
- **The directory is moving toward monetizable actions.** The owner wants a placement slot that a show can be given. At first this is test placements only, but the slot is meant to be sellable later.

## Decision

A day card groups its shows into sections. A show appears in **one** section,
the first it qualifies for:

1. **Specials** (`frequency: "once"`). No heading; pinned on top as before.
2. **New**: the show or its venue is new within a rolling 30 days, counted from today. The window starts at the later of a new `created` date and the first night (`activePeriod.start`).
3. **Featured**: the show carries a `featured` placement window covering the card's date.
4. **Verified**: the show's `lastVerified` is within a rolling 30 days, counted from today. A night still ahead counts.
5. **The rest**: no heading, always last.

Inside each section, order is alphabetical. Recency, frequency and placement
never decide position *within* a section.

**Display Philosophy #1 is amended, not excepted.** The neutral-directory rule
becomes: *Every show is listed, and position within a group is always
alphabetical. Groups reflect facts about a show (new, recently confirmed), plus
one owner-controlled placement group: Featured.* CLAUDE.md and the functional
spec are updated in the same change that ships sections.

**Gate on paid placement.** While Featured holds test placements only, the label
"Featured" stands. **Before the first paid placement**, the label and its
disclosure are revisited (for example "Sponsored" or "Promoted"), and that
decision is recorded as an amendment here or in a superseding ADR.

## Data

- `created: "YYYY-MM-DD"` on the venue and on the schedule entry. Stamped by the curator when the record is added. A Split (ADR-016) carries it forward unless the owner marks the new half as a genuinely new show. For launch, it is reconstructed once from git for records added in the last 30 days. Every older record stays undated, and undated means "not new".
- `featured: { start?, end? }` on the schedule entry: inclusive, either bound open, the same shape as `activePeriod`. Not allowed on `once` entries.

## Consequences

- **Good.** Signal (new, featured, recently confirmed) is visible without a click, and the regular schedule stays complete underneath. The grouping is a pure function over the rows `getVenueEventsForDate()` already emits. Filters, search, deduplication and the footer count are untouched.
- **Good.** Verification becomes visible to every visitor, not just behind `?fresh=1`. That rewards the confirmation work directly.
- **Cost.** The directory is no longer strictly neutral. A visitor can't tell a test placement from a paid one until the disclosure gate is met.
- **Cost.** Most of every night (85–90% today) sits in the unnamed remainder. That remainder is the regular schedule, and it carries no label that could read as "unreliable".
- **Cost.** Two new fields to curate. `created` is automatic. `featured` is a deliberate act each time.

## Alternatives considered

- **Most recently confirmed first, within Verified.** Rejected: it turns curator effort into placement, and venues that post weekly would always lead.
- **Counting windows from each card's date.** Rejected by the owner: the same show would sit in different sections on different cards in one week.
- **A fixed short Verified window (8 days).** Rejected: monthly shows could only be Verified a few days a month, even with perfect posters.
- **A `featured` boolean on the venue.** Rejected: the show is the unit (ADR-013), and a boolean never expires.
